// app/utils/email.js
// Shared email normalization and validation helpers.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trim and lowercase an email address for storage and lookup.
 *
 * @param {unknown} email
 * @returns {string}
 */
export function normalizeEmail(email) {
  return email?.toString().trim().toLowerCase() ?? '';
}

/**
 * Whether the value is a non-empty, well-formed email address.
 *
 * @param {unknown} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized !== '' && EMAIL_RE.test(normalized);
}
