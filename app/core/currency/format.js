// app/core/currency/format.js
// Client-safe currency formatting utilities. No server-only imports.
//
// Money is stored as integer "cents": 1/100 of the currency's major unit, for
// every currency (the admin price form multiplies by 100). Payment providers
// expect the ISO 4217 minor unit instead, which differs for zero-decimal
// (JPY) and three-decimal (KWD) currencies — convert with the helpers below.
// Zero-decimal currencies can't hold sub-unit amounts: ¥1 is 100 cents, so
// stored JPY cents are always a multiple of 100 (see `centsPerMinorUnit`).

const formatters = new Map();
const fractionDigits = new Map();

/**
 * @param {string} currency
 * @param {string} locale
 * @returns {Intl.NumberFormat}
 */
function getFormatter(currency, locale) {
  const key = `${locale}|${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
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
  const amount = cents / 100;
  // Intl throws RangeError for a null/malformed currency or locale. One bad
  // row must not take down a whole admin page or email render.
  try {
    return getFormatter(currency, locale).format(amount);
  } catch {
    try {
      return getFormatter(currency, 'en').format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency ?? ''}`.trim();
    }
  }
}

/**
 * ISO 4217 minor-unit digits for a currency (USD 2, JPY 0, KWD 3).
 *
 * @param {string} currency
 * @returns {number}
 */
export function currencyFractionDigits(currency) {
  let digits = fractionDigits.get(currency);
  if (digits === undefined) {
    digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
    fractionDigits.set(currency, digits);
  }
  return digits;
}

/**
 * Stored cents in the currency's smallest valid amount (USD 1, JPY 100).
 * Currencies with more than two minor-unit digits still store whole cents.
 *
 * @param {string} currency
 * @returns {number}
 */
export function centsPerMinorUnit(currency) {
  const digits = currencyFractionDigits(currency);
  return digits >= 2 ? 1 : 10 ** (2 - digits);
}

/**
 * Round stored cents to an amount the currency can represent
 * (150 JPY cents → 200, i.e. ¥1.50 → ¥2).
 *
 * @param {number} cents
 * @param {string} currency
 * @returns {number}
 */
export function roundCentsToCurrency(cents, currency) {
  const step = centsPerMinorUnit(currency);
  return Math.round(cents / step) * step;
}

/**
 * Whether stored cents are representable in the currency.
 *
 * @param {number} cents
 * @param {string} currency
 * @returns {boolean}
 */
export function isCentsAtCurrencyPrecision(cents, currency) {
  return cents % centsPerMinorUnit(currency) === 0;
}

/**
 * `step` attribute for a decimal major-unit price input ("0.01", JPY "1").
 *
 * @param {string} currency
 * @returns {string}
 */
export function currencyInputStep(currency) {
  return String(centsPerMinorUnit(currency) / 100);
}

/**
 * Parse a decimal major-unit form value into cents ("19.99" → 1999).
 * Returns null for blank or non-numeric input.
 *
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseDecimalToCents(raw) {
  const value = parseFloat(String(raw ?? ''));
  return Number.isNaN(value) ? null : Math.round(value * 100);
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

/**
 * Stored cents as the decimal shown in admin price inputs, at the precision
 * the input accepts (1999 USD → "19.99", 100000 JPY → "1000").
 *
 * @param {number} cents
 * @param {string} currency
 * @returns {string}
 */
export function centsToInputValue(cents, currency) {
  const digits = Math.min(2, currencyFractionDigits(currency));
  return (roundCentsToCurrency(cents, currency) / 100).toFixed(digits);
}
