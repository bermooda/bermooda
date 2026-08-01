// app/core/orders/place.server.js
// Transactional order placement from checkout.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { cartLineTotal } from '#/core/cart/lines';
import { expandBundleInventoryItems } from '#/core/catalog/types/index.server';
import {
  buildComputeTotalsParams,
  CHECKOUT_CART_INCLUDE,
  parseCheckoutSessionFields,
} from '#/core/checkout/session.server';
import { computeTotals } from '#/core/checkout/totals.server';
import { persistOrderDiscounts } from '#/core/discounts/index.server';
import { emitBefore } from '#/core/events/index.server';
import { queueEmit } from '#/core/events/job.server';
import { redeemGiftCard } from '#/core/gift-cards/index.server';
import { decrementInventory } from '#/core/inventory/index.server';
import { inventoryItemsFromLines } from '#/core/inventory/items';
import { redeemLoyaltyPoints } from '#/core/loyalty/index.server';
import { redeemStoreCredit } from '#/core/store-credit/index.server';

/**
 * @param {object} order
 * @param {string} checkoutSessionId
 * @returns {object}
 */
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
  await queueEmit('order.created', orderPayload);
  await queueEmit('checkout.completed', orderPayload);

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
 * @returns {Promise<object>}
 */
export async function attachPaymentIntent(orderId, paymentIntentId) {
  return prisma.order.update({
    where: { id: orderId },
    data: { paymentIntentId },
  });
}
