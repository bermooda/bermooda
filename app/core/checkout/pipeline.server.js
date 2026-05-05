// app/core/checkout/pipeline.server.js
// 4-step checkout pipeline: address → shipping → payment → review

import prisma from '#/libs/prisma.server';
import { lockCart, unlockCart } from '#/core/cart/index.server';
import { computeTotals } from './totals.server.js';

// ---------------------------------------------------------------------------
// Step order
// ---------------------------------------------------------------------------

const STEPS = ['address', 'shipping', 'payment', 'review'];

function nextStep(current) {
  const idx = STEPS.indexOf(current);
  if (idx === -1 || idx === STEPS.length - 1) return current;
  return STEPS[idx + 1];
}

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
export async function createCheckoutSession(cartId, { customerId, email } = {}) {
  await lockCart(cartId);

  const session = await prisma.checkoutSession.create({
    data: {
      cartId,
      customerId: customerId ?? null,
      email: email ?? null,
      step: 'address',
    },
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
        include: { lines: true },
      },
    },
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
        step: nextStep(step),
      };
      break;
    }

    case 'shipping': {
      if (!stepData.shippingOptionId) {
        throw new Error('MISSING_SHIPPING_OPTION');
      }
      updateData = {
        shippingOptionJson: stepData.shippingOptionJson ?? null,
        step: nextStep(step),
      };
      break;
    }

    case 'payment': {
      if (!stepData.paymentIntentId) {
        throw new Error('MISSING_PAYMENT_INTENT');
      }
      updateData = {
        paymentIntentId: stepData.paymentIntentId,
        step: nextStep(step),
      };
      break;
    }

    case 'review': {
      // Already at final step — return session as-is (with totals)
      break;
    }

    default:
      throw new Error(`UNKNOWN_STEP: ${step}`);
  }

  let updatedSession = session;

  if (Object.keys(updateData).length > 0) {
    updatedSession = await prisma.checkoutSession.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        cart: {
          include: { lines: true },
        },
      },
    });
  }

  // Re-compute totals from the latest session state
  const shippingAddress = updatedSession.shippingAddressJson
    ? JSON.parse(updatedSession.shippingAddressJson)
    : null;

  const shippingOption = updatedSession.shippingOptionJson
    ? JSON.parse(updatedSession.shippingOptionJson)
    : null;

  const totals = await computeTotals({
    cart: updatedSession.cart,
    shippingAddress,
    couponCode: updatedSession.couponCode ?? undefined,
    shippingOptionId: shippingOption?.id ?? undefined,
  });

  return { ...updatedSession, totals };
}

// ---------------------------------------------------------------------------
// abandonCheckoutSession
// ---------------------------------------------------------------------------

/**
 * Abandon a checkout session and unlock the associated cart.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function abandonCheckoutSession(sessionId) {
  const session = await prisma.checkoutSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error('CHECKOUT_SESSION_NOT_FOUND');
  }

  await unlockCart(session.cartId);
}
