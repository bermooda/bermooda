// app/core/orders/index.server.js
// Order service: transactional placement, fulfillment, and refunds.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { cartLineTotal } from '#/core/cart/lines';
import { expandBundleInventoryItems } from '#/core/catalog/types.server';
import {
  buildComputeTotalsParams,
  CHECKOUT_CART_INCLUDE,
  parseCheckoutSessionFields,
} from '#/core/checkout/session.server';
import { computeTotals } from '#/core/checkout/totals.server';
import { persistOrderDiscounts } from '#/core/discounts/index.server';
import { emit, emitBefore } from '#/core/events/index.server';
import { redeemGiftCard } from '#/core/gift-cards/index.server';
import {
  decrementInventory,
  incrementInventory,
} from '#/core/inventory/index.server';
import { inventoryItemsFromLines } from '#/core/inventory/items';
import { redeemLoyaltyPoints } from '#/core/loyalty/index.server';
import { getProvider } from '#/core/payments/index.server';
import { redeemStoreCredit } from '#/core/store-credit/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ORDER_STATUSES = new Set([
  'pending',
  'pending_payment',
  'confirmed',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
]);
function buildOrderEventPayload(order, checkoutSessionId) {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    checkoutSessionId,
    customerId: order.customerId,
    email: order.email,
    status: order.status,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    currency: order.currency,
  };
}

// ---------------------------------------------------------------------------
// placeOrder
// ---------------------------------------------------------------------------

/**
 * Transactionally place an order from a CheckoutSession at the 'review' step.
 *
 * Tax is recomputed from the session's shippingAddressJson + the checkout
 * totals engine (W0-2 fix — replaces the previous taxCents = 0 stub).
 *
 * All DB writes occur in a single $transaction. After commit:
 * - Inventory is decremented
 * - Cart is cleared
 * - CheckoutSession is marked completed
 * - 'order.created' event is emitted
 *
 * @param {string} checkoutSessionId
 * @param {{ paymentProvider?: string, paymentIntentId?: string }} options
 * @returns {Promise<object>} created Order with lines
 */
export async function placeOrder(
  checkoutSessionId,
  { paymentProvider, paymentIntentId } = {}
) {
  const preSession = await prisma.checkoutSession.findUnique({
    where: { id: checkoutSessionId },
    include: {
      cart: {
        include: CHECKOUT_CART_INCLUDE,
      },
    },
  });

  if (!preSession) {
    throw new Error('CHECKOUT_SESSION_NOT_FOUND');
  }

  if (preSession.step !== 'review') {
    throw new Error('CHECKOUT_SESSION_NOT_AT_REVIEW');
  }

  const preTotals = await computeTotals(
    buildComputeTotalsParams(preSession, preSession.cart)
  );

  await emitBefore('order.place', {
    checkoutSessionId,
    session: preSession,
    cart: preSession.cart,
    totals: preTotals,
  });

  let createdOrder;

  await prisma.$transaction(async (tx) => {
    // 1. Fetch CheckoutSession with cart + lines
    const session = await tx.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: {
        cart: {
          include: CHECKOUT_CART_INCLUDE,
        },
      },
    });

    if (!session) {
      throw new Error('CHECKOUT_SESSION_NOT_FOUND');
    }

    if (session.step !== 'review') {
      throw new Error('CHECKOUT_SESSION_NOT_AT_REVIEW');
    }

    const { cart } = session;
    const cartId = cart.id;
    const lines = cart.lines ?? [];

    const orderNumber = 'ORD-' + Date.now();

    const totals = await computeTotals(buildComputeTotalsParams(session, cart));

    const {
      subtotalCents,
      discountCents,
      shippingCents,
      taxCents,
      storeCreditCents,
      giftCardCents,
      loyaltyPointsCents,
      loyaltyPointsRedeemed,
      totalCents,
      appliedDiscounts,
      primaryCouponCode,
      giftCardId,
    } = totals;

    const effectiveProvider =
      paymentProvider ?? session.paymentProvider ?? null;
    const initialStatus =
      effectiveProvider === 'manual' ? 'pending_payment' : 'pending';
    const { shippingOption } = parseCheckoutSessionFields(session);
    const pickupLocationId = shippingOption?.pickupLocationId ?? null;

    const inventoryItems = await expandBundleInventoryItems(
      inventoryItemsFromLines(lines)
    );

    if (inventoryItems.length > 0) {
      await decrementInventory(inventoryItems, tx);
    }

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: session.customerId ?? null,
        email: session.email ?? '',
        status: initialStatus,
        currency: cart.currency,
        subtotalCents,
        shippingCents,
        taxCents,
        discountCents,
        storeCreditCents,
        giftCardCents,
        loyaltyPointsCents,
        totalCents,
        shippingAddressJson: session.shippingAddressJson ?? '{}',
        billingAddressJson: session.billingAddressJson ?? null,
        paymentProvider: effectiveProvider,
        paymentIntentId: paymentIntentId ?? null,
        pickupLocationId,
        couponCode: primaryCouponCode ?? session.couponCode ?? null,
        vatId: session.vatId ?? null,
        taxExempt: session.taxExempt ?? false,
        salesChannelId: session.salesChannelId ?? null,
      },
    });

    if (appliedDiscounts.length > 0) {
      await persistOrderDiscounts(order.id, appliedDiscounts, tx);
    }

    if (storeCreditCents > 0 && session.customerId) {
      await redeemStoreCredit(
        session.customerId,
        {
          amountCents: storeCreditCents,
          reason: 'Checkout redemption',
          referenceType: 'order',
          referenceId: order.id,
        },
        tx
      );
    }

    if (giftCardCents > 0 && giftCardId) {
      await redeemGiftCard(
        giftCardId,
        { amountCents: giftCardCents, orderId: order.id },
        tx
      );
    }

    if (
      loyaltyPointsCents > 0 &&
      loyaltyPointsRedeemed > 0 &&
      session.customerId
    ) {
      await redeemLoyaltyPoints(
        session.customerId,
        {
          points: loyaltyPointsRedeemed,
          reason: 'Checkout redemption',
          referenceType: 'order',
          referenceId: order.id,
        },
        tx
      );
    }

    // 6. Create OrderLine rows from cart lines
    for (const line of lines) {
      const lineTotalCents = cartLineTotal(line);
      await tx.orderLine.create({
        data: {
          orderId: order.id,
          variantId: line.variantId ?? null,
          title: line.titleSnapshot,
          sku: line.variant?.sku ?? null,
          quantity: line.quantity,
          priceCents: line.priceCentsSnapshot,
          totalCents: lineTotalCents,
        },
      });
    }

    // 7. Clear cart
    await tx.cartLine.deleteMany({ where: { cartId } });
    await tx.cart.update({
      where: { id: cartId },
      data: {
        lockedAt: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // 8. Mark CheckoutSession as completed
    await tx.checkoutSession.update({
      where: { id: checkoutSessionId },
      data: { step: 'completed' },
    });

    createdOrder = order;
  });

  // After transaction commits — emit event
  const orderPayload = buildOrderEventPayload(createdOrder, checkoutSessionId);
  await emit('order.created', orderPayload);
  await emit('checkout.completed', orderPayload);

  logger.info(
    { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber },
    'order placed'
  );

  return createdOrder;
}

/**
 * Attach a Stripe PaymentIntent id to a placed order.
 *
 * @param {string} orderId
 * @param {string} paymentIntentId
 */
export async function attachPaymentIntent(orderId, paymentIntentId) {
  return prisma.order.update({
    where: { id: orderId },
    data: { paymentIntentId },
  });
}

// ---------------------------------------------------------------------------
// getOrder
// ---------------------------------------------------------------------------

/**
 * Fetch an order by id with lines, shipments, and refunds.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getOrder(id) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      lines: true,
      shipments: { include: { lines: { include: { orderLine: true } } } },
      refunds: true,
      returns: { include: { lines: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// listOrders
// ---------------------------------------------------------------------------

/**
 * List orders with lines. Newest first.
 * @param {{ customerId?: string, status?: string, page?: number, limit?: number }} options
 * @returns {Promise<object[]>}
 */
export async function listOrders({
  customerId,
  status,
  page = 1,
  limit = 20,
} = {}) {
  const where = {};
  if (customerId !== undefined) where.customerId = customerId;
  if (status !== undefined) where.status = status;

  const skip = (page - 1) * limit;

  return prisma.order.findMany({
    where,
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// updateOrderStatus
// ---------------------------------------------------------------------------

/**
 * Update an order's status. Throws for unknown status values.
 * @param {string} id
 * @param {string} status
 * @returns {Promise<object>}
 */
export async function updateOrderStatus(id, status) {
  if (!VALID_ORDER_STATUSES.has(status)) {
    throw new Error('INVALID_ORDER_STATUS');
  }

  const current = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
  });

  if (current && current.status !== status) {
    await emit('order.updated', {
      orderId: id,
      previousStatus: current.status,
      status,
    });
  }

  return updated;
}

// ---------------------------------------------------------------------------
// cancelOrder
// ---------------------------------------------------------------------------

/**
 * Cancel an order: restore inventory for all lines, then mark cancelled.
 * Emits 'order.cancelled'.
 *
 * @param {string} orderId
 * @returns {Promise<object>} updated Order
 */
export async function cancelOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  await emitBefore('order.cancel', { orderId, order });

  await restoreOrderLineInventory(order.lines);

  const updated = await updateOrderStatus(orderId, 'cancelled');

  await emit('order.cancelled', { orderId, orderNumber: order.orderNumber });

  logger.info({ orderId, orderNumber: order.orderNumber }, 'order cancelled');

  return updated;
}

/**
 * Restore inventory for tracked order lines.
 * @param {Array<{ variantId?: string|null, quantity: number }>} lines
 */
async function restoreOrderLineInventory(lines = []) {
  const items = inventoryItemsFromLines(lines);
  if (items.length > 0) {
    await incrementInventory(items);
  }
}

// ---------------------------------------------------------------------------
// Fulfillment helpers
// ---------------------------------------------------------------------------

/**
 * Derive fulfillment status from order line quantities.
 * @param {Array<{ quantity: number, fulfilledQuantity: number }>} lines
 * @returns {'unfulfilled'|'partial'|'fulfilled'}
 */
export function deriveFulfillmentStatus(lines) {
  if (!lines?.length) return 'unfulfilled';

  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  const fulfilledQty = lines.reduce(
    (sum, l) => sum + (l.fulfilledQuantity ?? 0),
    0
  );

  if (fulfilledQty === 0) return 'unfulfilled';
  if (fulfilledQty >= totalQty) return 'fulfilled';
  return 'partial';
}

/**
 * Sync order status from fulfillment state.
 * @param {string} orderId
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 */
export async function syncOrderFulfillmentStatus(orderId, tx) {
  const client = tx ?? prisma;
  const order = await client.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) return;

  const fulfillment = deriveFulfillmentStatus(order.lines);

  if (
    fulfillment === 'fulfilled' &&
    ['paid', 'confirmed'].includes(order.status)
  ) {
    if (tx) {
      await client.order.update({
        where: { id: orderId },
        data: { status: 'fulfilled' },
      });
      await emit('order.updated', {
        orderId,
        previousStatus: order.status,
        status: 'fulfilled',
      });
    } else {
      await updateOrderStatus(orderId, 'fulfilled');
    }

    await emit('order.fulfilled', {
      orderId,
      status: 'fulfilled',
    });
  }
}

// ---------------------------------------------------------------------------
// addShipment
// ---------------------------------------------------------------------------

/**
 * Create a Shipment record for an order with optional per-line quantities.
 * @param {string} orderId
 * @param {{
 *   carrier?: string,
 *   trackingNumber?: string,
 *   trackingUrl?: string,
 *   lines?: Array<{ orderLineId: string, quantity: number }>,
 * }} data
 * @returns {Promise<object>} created Shipment
 */
export async function addShipment(orderId, data = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const shipmentLines = data.lines ?? [];

  if (shipmentLines.length > 0) {
    validateShipmentLines(order.lines, shipmentLines);
  }

  await emitBefore('shipment.create', { orderId, order, data });

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId,
        carrier: data.carrier ?? null,
        trackingNumber: data.trackingNumber ?? null,
        trackingUrl: data.trackingUrl ?? null,
      },
    });

    for (const line of shipmentLines) {
      await tx.shipmentLine.create({
        data: {
          shipmentId: created.id,
          orderLineId: line.orderLineId,
          quantity: line.quantity,
        },
      });
    }

    return tx.shipment.findUnique({
      where: { id: created.id },
      include: { lines: { include: { orderLine: true } } },
    });
  });

  await emit('shipment.created', { shipmentId: shipment.id, orderId });

  return shipment;
}

/**
 * @param {object[]} orderLines
 * @param {Array<{ orderLineId: string, quantity: number }>} requestedLines
 */
function validateShipmentLines(orderLines, requestedLines) {
  const lineMap = new Map(orderLines.map((l) => [l.id, l]));

  for (const req of requestedLines) {
    const orderLine = lineMap.get(req.orderLineId);
    if (!orderLine) {
      throw new Error('INVALID_ORDER_LINE');
    }

    const remaining = orderLine.quantity - (orderLine.fulfilledQuantity ?? 0);

    if (req.quantity <= 0 || req.quantity > remaining) {
      throw new Error('INVALID_SHIPMENT_QUANTITY');
    }
  }
}

// ---------------------------------------------------------------------------
// markShipped
// ---------------------------------------------------------------------------

/**
 * Mark a shipment as shipped.
 * @param {string} shipmentId
 * @param {{ carrier?: string, trackingNumber?: string, trackingUrl?: string }} data
 * @returns {Promise<object>} updated Shipment
 */
export async function markShipped(
  shipmentId,
  { carrier, trackingNumber, trackingUrl } = {}
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { lines: true, order: { include: { lines: true } } },
  });

  if (!shipment) {
    throw new Error('SHIPMENT_NOT_FOUND');
  }

  await emitBefore('shipment.ship', {
    shipmentId,
    orderId: shipment.orderId,
    shipment,
    order: shipment.order,
    data: { carrier, trackingNumber, trackingUrl },
  });

  const updateData = {
    status: 'shipped',
    shippedAt: new Date(),
  };

  if (carrier !== undefined) updateData.carrier = carrier;
  if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
  if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.shipment.update({
      where: { id: shipmentId },
      data: updateData,
      include: { lines: true },
    });

    const linesToFulfill =
      result.lines.length > 0
        ? result.lines
        : shipment.order.lines.map((ol) => ({
            orderLineId: ol.id,
            quantity: ol.quantity - (ol.fulfilledQuantity ?? 0),
          }));

    for (const line of linesToFulfill) {
      if (line.quantity <= 0) continue;

      await tx.orderLine.update({
        where: { id: line.orderLineId },
        data: {
          fulfilledQuantity: { increment: line.quantity },
        },
      });

      if (result.lines.length === 0) {
        await tx.shipmentLine.create({
          data: {
            shipmentId,
            orderLineId: line.orderLineId,
            quantity: line.quantity,
          },
        });
      }
    }

    await syncOrderFulfillmentStatus(shipment.orderId, tx);

    return result;
  });

  await emit('shipment.shipped', {
    shipmentId,
    orderId: shipment.orderId,
    carrier: updated.carrier,
    trackingNumber: updated.trackingNumber,
    trackingUrl: updated.trackingUrl,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// markDelivered
// ---------------------------------------------------------------------------

/**
 * Mark a shipment as delivered.
 * @param {string} shipmentId
 * @returns {Promise<object>} updated Shipment
 */
export async function markDelivered(shipmentId) {
  const existing = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!existing) {
    throw new Error('SHIPMENT_NOT_FOUND');
  }

  await emitBefore('shipment.deliver', {
    shipmentId,
    orderId: existing.orderId,
    shipment: existing,
  });

  const shipment = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
    },
  });

  await emit('shipment.delivered', { shipmentId, orderId: shipment.orderId });

  return shipment;
}

// ---------------------------------------------------------------------------
// createRefund
// ---------------------------------------------------------------------------

/**
 * Create a Refund record for an order.
 *
 * @param {string} orderId
 * @param {{
 *   amountCents: number,
 *   reason?: string,
 *   providerRefundId?: string,
 *   restoreInventory?: boolean,
 * }} data
 * @returns {Promise<object>} created Refund
 */
export async function createRefund(
  orderId,
  { amountCents, reason, providerRefundId, restoreInventory = true } = {}
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  await emitBefore('refund.create', { orderId, order, amountCents, reason });

  let effectiveProviderRefundId = providerRefundId ?? null;

  if (
    !effectiveProviderRefundId &&
    order.paymentIntentId &&
    order.paymentProvider &&
    order.paymentProvider !== 'manual'
  ) {
    const provider = getProvider(order.paymentProvider);
    if (typeof provider.createRefund === 'function') {
      const result = await provider.createRefund({
        paymentIntentId: order.paymentIntentId,
        amountCents,
        reason: reason ?? 'requested_by_customer',
        currency: order.currency,
      });
      effectiveProviderRefundId = result.refundId ?? null;
    }
  }

  const refund = await prisma.refund.create({
    data: {
      orderId,
      amountCents,
      reason: reason ?? null,
      providerRefundId: effectiveProviderRefundId,
    },
  });

  if (restoreInventory) {
    await restoreOrderLineInventory(order.lines);
  }

  await emit('payment.refunded', { refundId: refund.id, orderId, amountCents });

  return refund;
}

// ---------------------------------------------------------------------------
// registerPaymentEventHandlers
// ---------------------------------------------------------------------------

/**
 * Register domain-event subscribers for payment lifecycle events.
 * Called once from bootstrap.server.js.
 *
 * W0-4:
 *   payment.succeeded → mark order 'confirmed' + emit order.confirmed
 *   payment.failed    → cancel order (restores inventory) + mark 'cancelled'
 *
 * @param {{ on: Function }} events
 */
export function registerPaymentEventHandlers({ on }) {
  on('payment.succeeded', async (payload) => {
    if (!payload.orderId) return;
    try {
      await updateOrderStatus(payload.orderId, 'confirmed');
      await emit('order.confirmed', {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
      });
      logger.info(
        { orderId: payload.orderId },
        'payment.succeeded → order confirmed'
      );
    } catch (err) {
      logger.error(
        { err, orderId: payload.orderId },
        'Failed to confirm order on payment.succeeded'
      );
    }
  });

  on('payment.failed', async (payload) => {
    if (!payload.orderId) return;
    try {
      await cancelOrder(payload.orderId);
      logger.info(
        { orderId: payload.orderId },
        'payment.failed → order cancelled'
      );
    } catch (err) {
      logger.error(
        { err, orderId: payload.orderId },
        'Failed to cancel order on payment.failed'
      );
    }
  });
}
