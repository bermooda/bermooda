// app/core/checkout/session.js
// Client-safe checkout step constants.

export const CHECKOUT_STEP = 'checkout';

/** @deprecated Use CHECKOUT_STEP — kept for callers that still iterate steps. */
export const CHECKOUT_STEPS = [CHECKOUT_STEP];

/**
 * @param {string} step
 * @returns {boolean}
 */
export function isValidCheckoutStep(step) {
  return step === CHECKOUT_STEP;
}

/**
 * @param {string} [_current]
 * @returns {string}
 */
export function nextCheckoutStep(_current) {
  return CHECKOUT_STEP;
}
