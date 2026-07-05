// app/core/checkout/pipeline.server.js
// 4-step checkout pipeline: address → shipping → payment → review

import prisma from '#/libs/prisma.server';

import { lockCart } from '#/core/cart/index.server';
import {
  buildComputeTotalsParams,
  CHECKOUT_CART_INCLUDE,
  nextCheckoutStep,
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
      step: 'address',
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
// advanceStep
// ---------------------------------------------------------------------------

/**
 * Advance the checkout session to the next step.
 * Validates step-specific data, persists it, re-computes totals,
 * and returns the updated session with a `totals` property attached.
 *
 * Expected stepData per step:
 *   address  → { shippingAddressJson, billingAddressJson?, email? }
 *   shipping → { shippingOptionId, shippingOptionJson? }
 *   payment  → { paymentProvider }
 *   review   → (no-op — caller handles order placement)
 *
 * @param {string} sessionId
 * @param {object} stepData
 * @returns {Promise<object>} updated session with `totals`
 */
export async function advanceStep(sessionId, stepData = {}) {
  const session = await getCheckoutSession(sessionId);
  if (!session) {
    throw new Error('CHECKOUT_SESSION_NOT_FOUND');
  }

  const { step } = session;
  let updateData = {};

  switch (step) {
    case 'address': {
      if (!stepData.shippingAddressJson) {
        throw new Error('MISSING_SHIPPING_ADDRESS');
      }
      updateData = {
        shippingAddressJson: stepData.shippingAddressJson,
        billingAddressJson: stepData.billingAddressJson ?? null,
        ...(stepData.email ? { email: stepData.email } : {}),
        ...(stepData.vatId !== undefined ? { vatId: stepData.vatId } : {}),
        ...(stepData.taxExempt !== undefined
          ? { taxExempt: stepData.taxExempt }
          : {}),
        ...(stepData.couponCode !== undefined
          ? { couponCode: stepData.couponCode }
          : {}),
        step: nextCheckoutStep(step),
      };
      break;
    }

    case 'shipping': {
      if (!stepData.shippingOptionId) {
        throw new Error('MISSING_SHIPPING_OPTION');
      }
      if (!stepData.shippingOptionJson) {
        throw new Error('INVALID_SHIPPING_OPTION');
      }
      updateData = {
        shippingOptionJson: stepData.shippingOptionJson,
        step: nextCheckoutStep(step),
      };
      break;
    }

    case 'payment': {
      if (!stepData.paymentProvider) {
        throw new Error('MISSING_PAYMENT_PROVIDER');
      }
      updateData = {
        paymentProvider: stepData.paymentProvider,
        ...(stepData.giftCardCode !== undefined
          ? { giftCardCode: stepData.giftCardCode }
          : {}),
        ...(stepData.storeCreditCents !== undefined
          ? { storeCreditCents: stepData.storeCreditCents }
          : {}),
        ...(stepData.loyaltyPointsCents !== undefined
          ? { loyaltyPointsCents: stepData.loyaltyPointsCents }
          : {}),
        step: nextCheckoutStep(step),
      };
      break;
    }

    case 'review': {
      // The review step is handled separately in the route action (placeOrder +
      // provider redirect). advanceStep is a no-op here; callers should not
      // call advanceStep at the review step.
      break;
    }

    default:
      throw new Error(`UNKNOWN_STEP: ${step}`);
  }

  let updatedSession = session;

  if (Object.keys(updateData).length > 0) {
    await emitBefore('checkout.advance', {
      sessionId,
      session,
      fromStep: step,
      toStep: updateData.step,
      stepData,
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
