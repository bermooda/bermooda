// app/core/orders/index.server.js
// Order service: transactional placement, fulfillment, and refunds.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { validateDiscount } from '#/core/discounts/index.server';
import { emit } from '#/core/events/index.server';
import {
  decrementInventory,
  incrementInventory,
} from '#/core/inventory/index.server';
import { computeActiveTax } from '#/core/tax/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ORDER_STATUSES = new Set([
  'pending',
  'confirmed',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
]);
const VALID_REFUND_STATUSES = new Set(['pending', 'succeeded', 'failed']);

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
  let createdOrder;

  await prisma.$transaction(async (tx) => {
    // 1. Fetch CheckoutSession with cart + lines
    const session = await tx.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: {
        cart: {
          include: {
            lines: {
              include: { variant: true },
            },
          },
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

    // 2. Compute order number
    const orderNumber = 'ORD-' + Date.now();

    // 3. Re-compute totals from cart lines
    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.priceCentsSnapshot * line.quantity,
      0
    );

    let discountCents = 0;
    if (session.couponCode) {
      // Validate discount without side effects, then atomically increment usedCount
      const discountResult = await validateDiscount(session.couponCode, {
        subtotalCents,
        currency: cart.currency,
      });
      discountCents = discountResult.discountCents;

      // Atomically increment usedCount inside the transaction
      await tx.discount.update({
        where: { code: session.couponCode },
        data: { usedCount: { increment: 1 } },
      });
    }

    // Parse shipping option for shippingCents
    let shippingCents = 0;
    if (session.shippingOptionJson) {
      try {
        const shippingOption = JSON.parse(session.shippingOptionJson);
        shippingCents = shippingOption.priceCents ?? 0;
      } catch {
        // malformed JSON — treat as zero
      }
    }

    // W0-2: Compute real tax from the session's shipping address + provider.
    // Uses the active tax provider (default: simple_percent). Reads settings
    // from the DB (read-only, safe to call inside the transaction context).
    let taxCents = 0;
    const shippingAddress = session.shippingAddressJson
      ? JSON.parse(session.shippingAddressJson)
      : null;

    if (shippingAddress) {
      try {
        const taxResult = await computeActiveTax({
          subtotalCents: subtotalCents - discountCents,
          shippingCents,
          shippingAddress,
          currency: cart.currency,
        });
        taxCents = Math.round(taxResult.taxCents);
      } catch (err) {
        logger.warn(
          { err },
          'Tax computation failed during placeOrder — using 0'
        );
      }
    }

    const totalCents = subtotalCents - discountCents + shippingCents + taxCents;

    // 4. Decrement inventory (pass tx so it's part of the same transaction)
    const inventoryItems = lines
      .filter((line) => line.variantId != null)
      .map((line) => ({ variantId: line.variantId, quantity: line.quantity }));

    if (inventoryItems.length > 0) {
      await decrementInventory(inventoryItems, tx);
    }

    // 5. Create Order row
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: session.customerId ?? null,
        email: session.email ?? '',
        status: 'pending',
        currency: cart.currency,
        subtotalCents,
        shippingCents,
        taxCents,
        discountCents,
        totalCents,
        shippingAddressJson: session.shippingAddressJson ?? '{}',
        billingAddressJson: session.billingAddressJson ?? null,
        paymentProvider: paymentProvider ?? session.paymentProvider ?? null,
        paymentIntentId: paymentIntentId ?? null,
        couponCode: session.couponCode ?? null,
      },
    });

    // 6. Create OrderLine rows from cart lines
    for (const line of lines) {
      const lineTotalCents = line.priceCentsSnapshot * line.quantity;
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
  await emit('order.created', {
    orderId: createdOrder.id,
    orderNumber: createdOrder.orderNumber,
    customerId: createdOrder.customerId,
    email: createdOrder.email,
    totalCents: createdOrder.totalCents,
    currency: createdOrder.currency,
  });

  logger.info(
    { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber },
    'order placed'
  );

  return createdOrder;
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
      shipments: true,
      refunds: true,
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

  return prisma.order.update({
    where: { id },
    data: { status },
  });
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
  const order = await getOrder(orderId);

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  // Restore inventory for all tracked order lines (W0-5)
  const inventoryItems = (order.lines ?? [])
    .filter((line) => line.variantId != null)
    .map((line) => ({ variantId: line.variantId, quantity: line.quantity }));

  if (inventoryItems.length > 0) {
    await incrementInventory(inventoryItems);
  }

  const updated = await updateOrderStatus(orderId, 'cancelled');

  await emit('order.cancelled', { orderId, orderNumber: order.orderNumber });

  logger.info({ orderId, orderNumber: order.orderNumber }, 'order cancelled');

  return updated;
}

// ---------------------------------------------------------------------------
// addShipment
// ---------------------------------------------------------------------------

/**
 * Create a Shipment record for an order.
 * @param {string} orderId
 * @param {{ carrier?: string, trackingNumber?: string, trackingUrl?: string }} data
 * @returns {Promise<object>} created Shipment
 */
export async function addShipment(orderId, data = {}) {
  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      carrier: data.carrier ?? null,
      trackingNumber: data.trackingNumber ?? null,
      trackingUrl: data.trackingUrl ?? null,
    },
  });

  await emit('shipment.created', { shipmentId: shipment.id, orderId });

  return shipment;
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
  const updateData = {
    status: 'shipped',
    shippedAt: new Date(),
  };

  if (carrier !== undefined) updateData.carrier = carrier;
  if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
  if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;

  const shipment = await prisma.shipment.update({
    where: { id: shipmentId },
    data: updateData,
  });

  await emit('shipment.shipped', { shipmentId, orderId: shipment.orderId });

  return shipment;
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
 * Create a Refund record for an order and restore inventory for all order
 * lines (W0-5). For partial refunds the full inventory is still restored here;
 * fine-grained per-line return logic arrives in W4 (Returns/RMA).
 *
 * @param {string} orderId
 * @param {{ amountCents: number, reason?: string, providerRefundId?: string }} data
 * @returns {Promise<object>} created Refund
 */
export async function createRefund(
  orderId,
  { amountCents, reason, providerRefundId } = {}
) {
  const refund = await prisma.refund.create({
    data: {
      orderId,
      amountCents,
      reason: reason ?? null,
      providerRefundId: providerRefundId ?? null,
    },
  });

  // W0-5: Restore inventory for all order lines on refund.
  // Full per-line granularity is handled in W4; for now restore everything.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (order) {
    const inventoryItems = (order.lines ?? [])
      .filter((line) => line.variantId != null)
      .map((line) => ({ variantId: line.variantId, quantity: line.quantity }));

    if (inventoryItems.length > 0) {
      await incrementInventory(inventoryItems);
    }
  }

  await emit('payment.refunded', { refundId: refund.id, orderId, amountCents });

  return refund;
}

// ---------------------------------------------------------------------------
// updateRefundStatus
// ---------------------------------------------------------------------------

/**
 * Update refund status.
 * @param {string} refundId
 * @param {string} status - 'pending' | 'succeeded' | 'failed'
 * @returns {Promise<object>} updated Refund
 */
export async function updateRefundStatus(refundId, status) {
  if (!VALID_REFUND_STATUSES.has(status)) {
    throw new Error('INVALID_REFUND_STATUS');
  }

  return prisma.refund.update({
    where: { id: refundId },
    data: { status },
  });
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
