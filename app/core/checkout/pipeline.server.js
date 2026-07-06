// app/core/checkout/pipeline.server.js
// Single-page checkout session pipeline.

import prisma from '#/libs/prisma.server';
import { lockCart } from '#/core/cart/index.server';
import {
  buildComputeTotalsParams,
  CHECKOUT_CART_INCLUDE,
  CHECKOUT_STEP,
} from '#/core/checkout/session.server';
import { computeTotals } from '#/core/checkout/totals.server';
import { emit, emitBefore } from '#/core/events/index.server';

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

/**
 * Create a new CheckoutSession for a cart. Locks the cart.
 *
 * @param {string} cartId
 * @param {{ customerId?: string, email?: string }} options
 * @returns {Promise<object>} created CheckoutSession
 */
export async function createCheckoutSession(
  cartId,
  { customerId, email } = {}
) {
  await lockCart(cartId);

  const session = await prisma.checkoutSession.create({
    data: {
      cartId,
      customerId: customerId ?? null,
      email: email ?? null,
      step: CHECKOUT_STEP,
    },
  });

  await emit('checkout.started', {
    sessionId: session.id,
    cartId: session.cartId,
    customerId: session.customerId,
    email: session.email,
  });

  return session;
}

// ---------------------------------------------------------------------------
// getCheckoutSession
// ---------------------------------------------------------------------------

/**
 * Get a checkout session including its cart and lines.
 *
 * @param {string} sessionId
 * @returns {Promise<object>} CheckoutSession with cart + lines
 */
export async function getCheckoutSession(sessionId) {
  return prisma.checkoutSession.findUnique({
    where: { id: sessionId },
    include: {
      cart: {
        include: CHECKOUT_CART_INCLUDE,
      },
    },
  });
}

/**
 * Attach a logged-in customer to a checkout session when not already linked.
 *
 * @param {string} sessionId
 * @param {string} customerId
 * @returns {Promise<object|null>} updated session or existing session
 */
export async function linkCheckoutCustomer(sessionId, customerId) {
  if (!customerId) return null;

  const session = await prisma.checkoutSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.customerId) return session;

  return prisma.checkoutSession.update({
    where: { id: sessionId },
    data: { customerId },
  });
}

// ---------------------------------------------------------------------------
// updateCheckoutSession
// ---------------------------------------------------------------------------

/**
 * Persist checkout fields for the single-page flow.
 *
 * @param {string} sessionId
 * @param {object} data
 * @param {{ requireComplete?: boolean }} [options]
 * @returns {Promise<object>} updated session with `totals`
 */
export async function updateCheckoutSession(
  sessionId,
  data = {},
  { requireComplete = false } = {}
) {
  const session = await getCheckoutSession(sessionId);
  if (!session) {
    throw new Error('CHECKOUT_SESSION_NOT_FOUND');
  }

  if (requireComplete) {
    if (!data.shippingAddressJson) {
      throw new Error('MISSING_SHIPPING_ADDRESS');
    }
    if (!data.shippingOptionJson) {
      throw new Error('MISSING_SHIPPING_OPTION');
    }
    if (!data.paymentProvider) {
      throw new Error('MISSING_PAYMENT_PROVIDER');
    }
  }

  const updateData = {
    step: CHECKOUT_STEP,
    ...(data.shippingAddressJson !== undefined
      ? { shippingAddressJson: data.shippingAddressJson }
      : {}),
    ...(data.billingAddressJson !== undefined
      ? { billingAddressJson: data.billingAddressJson }
      : {}),
    ...(data.shippingOptionJson !== undefined
      ? { shippingOptionJson: data.shippingOptionJson }
      : {}),
    ...(data.email !== undefined ? { email: data.email } : {}),
    ...(data.vatId !== undefined ? { vatId: data.vatId } : {}),
    ...(data.taxExempt !== undefined ? { taxExempt: data.taxExempt } : {}),
    ...(data.couponCode !== undefined ? { couponCode: data.couponCode } : {}),
    ...(data.paymentProvider !== undefined
      ? { paymentProvider: data.paymentProvider }
      : {}),
    ...(data.giftCardCode !== undefined
      ? { giftCardCode: data.giftCardCode }
      : {}),
    ...(data.storeCreditCents !== undefined
      ? { storeCreditCents: data.storeCreditCents }
      : {}),
    ...(data.loyaltyPointsCents !== undefined
      ? { loyaltyPointsCents: data.loyaltyPointsCents }
      : {}),
  };

  let updatedSession = session;

  if (Object.keys(updateData).length > 1) {
    await emitBefore('checkout.advance', {
      sessionId,
      session,
      fromStep: session.step ?? CHECKOUT_STEP,
      toStep: CHECKOUT_STEP,
      stepData: data,
    });

    updatedSession = await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        cart: {
          include: CHECKOUT_CART_INCLUDE,
        },
      },
    });
  }

  const totals = await computeTotals(
    buildComputeTotalsParams(updatedSession, updatedSession.cart)
  );

  return { ...updatedSession, totals };
}
