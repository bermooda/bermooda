// app/core/checkout/session.js
// Client-safe checkout step constants.

export const CHECKOUT_STEPS = ['address', 'shipping', 'payment', 'review'];

/**
 * @param {string} step
 * @returns {boolean}
 */
export function isValidCheckoutStep(step) {
  return CHECKOUT_STEPS.includes(step);
}

/**
 * @param {string} current
 * @returns {string}
 */
export function nextCheckoutStep(current) {
  const idx = CHECKOUT_STEPS.indexOf(current);
  if (idx === -1 || idx === CHECKOUT_STEPS.length - 1) return current;
  return CHECKOUT_STEPS[idx + 1];
}
