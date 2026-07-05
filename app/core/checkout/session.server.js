// app/core/checkout/session.server.js
// Shared checkout session parsing and computeTotals param building.

export {
  CHECKOUT_STEPS,
  isValidCheckoutStep,
  nextCheckoutStep,
} from '#/core/checkout/session.js';

/** Prisma include for checkout cart + tax-aware lines. */
export const CHECKOUT_CART_INCLUDE = {
  lines: {
    include: { variant: { include: { taxClass: true } } },
  },
};

/**
 * Parse JSON address/option fields from a checkout session row.
 *
 * @param {object|null|undefined} session
 * @returns {{
 *   shippingAddress: object|null,
 *   billingAddress: object|null,
 *   shippingOption: object|null,
 * }}
 */
export function parseCheckoutSessionFields(session) {
  if (!session) {
    return {
      shippingAddress: null,
      billingAddress: null,
      shippingOption: null,
    };
  }

  return {
    shippingAddress: session.shippingAddressJson
      ? JSON.parse(session.shippingAddressJson)
      : null,
    billingAddress: session.billingAddressJson
      ? JSON.parse(session.billingAddressJson)
      : null,
    shippingOption: session.shippingOptionJson
      ? JSON.parse(session.shippingOptionJson)
      : null,
  };
}

/**
 * Build computeTotals params from a checkout session and cart.
 *
 * @param {object} session
 * @param {object} cart
 * @param {{ shippingAddress?: object|null, shippingOption?: object|null }} [parsed]
 * @returns {object}
 */
export function buildComputeTotalsParams(session, cart, parsed = {}) {
  const { shippingAddress, shippingOption } = {
    ...parseCheckoutSessionFields(session),
    ...parsed,
  };

  return {
    cart,
    shippingAddress,
    couponCode: session.couponCode ?? undefined,
    shippingOptionId: shippingOption?.id ?? undefined,
    taxExempt: session.taxExempt ?? false,
    vatId: session.vatId ?? undefined,
    customerId: session.customerId ?? undefined,
    giftCardCode: session.giftCardCode ?? undefined,
    storeCreditCents: session.storeCreditCents ?? 0,
    loyaltyPointsCents: session.loyaltyPointsCents ?? 0,
    salesChannelId: session.salesChannelId ?? undefined,
  };
}

/**
 * Parse JSON session fields for theme/route consumers.
 *
 * @param {object|null|undefined} session
 * @returns {object|null}
 */
export function normaliseCheckoutSessionForDisplay(session) {
  if (!session) return session;

  const { shippingAddress, billingAddress, shippingOption } =
    parseCheckoutSessionFields(session);

  return {
    ...session,
    shippingAddress,
    billingAddress,
    shippingOption,
    shippingOptionId: shippingOption?.id ?? null,
  };
}

// Re-export under the name used by session.js if needed elsewhere
export { normaliseCheckoutSessionForDisplay as normaliseCheckoutSession };
