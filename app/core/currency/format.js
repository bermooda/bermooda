// app/core/currency/format.js
// Client-safe currency formatting utilities. No server-only imports.
//
// Money is stored as integer "cents": 1/100 of the currency's major unit, for
// every currency (the admin price form multiplies by 100). Payment providers
// expect the ISO 4217 minor unit instead, which differs for zero-decimal
// (JPY) and three-decimal (KWD) currencies — convert with the helpers below.

const formatters = new Map();

/**
 * @param {string} currency
 * @param {string} locale
 * @returns {Intl.NumberFormat}
 */
function getFormatter(currency, locale) {
  const key = `${locale}|${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Format a price in cents to a locale-aware currency string.
 *
 * @param {number} cents - Amount in cents (1/100 major unit, e.g. 1999 = $19.99)
 * @param {string} [currency='USD'] - ISO 4217 currency code
 * @param {string} [locale='en'] - BCP 47 locale tag
 * @returns {string} Formatted price string
 */
export function formatPrice(cents, currency = 'USD', locale = 'en') {
  return getFormatter(currency, locale).format(cents / 100);
}

/**
 * ISO 4217 minor-unit digits for a currency (USD 2, JPY 0, KWD 3).
 *
 * @param {string} currency
 * @returns {number}
 */
export function currencyFractionDigits(currency) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits;
}

/**
 * Convert stored cents to the integer minor-unit amount providers such as
 * Stripe expect (1999 USD → 1999, 100000 JPY → 1000, 1234 KWD → 12340).
 *
 * @param {number} cents
 * @param {string} currency
 * @returns {number}
 */
export function centsToMinorUnits(cents, currency) {
  const digits = currencyFractionDigits(currency);
  return digits >= 2
    ? cents * 10 ** (digits - 2)
    : Math.round(cents / 10 ** (2 - digits));
}

/**
 * Convert stored cents to a decimal major-unit string with the currency's
 * minor-unit precision, as PayPal expects (1999 USD → "19.99",
 * 100000 JPY → "1000").
 *
 * @param {number} cents
 * @param {string} currency
 * @returns {string}
 */
export function centsToMajorUnitString(cents, currency) {
  const digits = currencyFractionDigits(currency);
  return (centsToMinorUnits(cents, currency) / 10 ** digits).toFixed(digits);
}
