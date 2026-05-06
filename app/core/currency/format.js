// app/core/currency/format.js
// Client-safe currency formatting utilities. No server-only imports.

/**
 * Format a price in cents to a locale-aware currency string.
 *
 * @param {number} cents - Amount in smallest currency unit (e.g. 1999 = $19.99)
 * @param {string} [currency='USD'] - ISO 4217 currency code
 * @param {string} [locale='en'] - BCP 47 locale tag
 * @returns {string} Formatted price string
 */
export function formatPrice(cents, currency = 'USD', locale = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
