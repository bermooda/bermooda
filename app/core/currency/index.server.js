// app/core/currency/index.server.js

import {
  DEFAULT_CURRENCY,
  SETTING_KEYS,
  get as settingsGet,
  getEnabledCurrencies,
} from '#/core/settings/index.server';

const CURRENCY_RE = /^[A-Z]{3}$/;

// ---------------------------------------------------------------------------
// getRequestCurrency
// ---------------------------------------------------------------------------

/**
 * Resolve the currency for an incoming request.
 * Resolution order:
 *   1. `currency` cookie value, when it is an enabled currency
 *   2. `defaultCurrency` setting
 *   3. Hard fallback: 'USD'
 *
 * The cookie is client-controlled, so a code the merchant has not enabled
 * (or has since disabled) must never reach cart creation or checkout.
 *
 * @param {Request} request
 * @returns {Promise<string>} 3-letter ISO currency code
 */
export async function getRequestCurrency(request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)currency=([^;]+)/);
  const fromCookie = match?.[1].trim();
  if (fromCookie && CURRENCY_RE.test(fromCookie)) {
    const enabled = await getEnabledCurrencies();
    if (enabled.includes(fromCookie)) return fromCookie;
  }

  const fromSettings = await settingsGet(SETTING_KEYS.DEFAULT_CURRENCY);
  if (fromSettings) return fromSettings;

  return DEFAULT_CURRENCY;
}

// ---------------------------------------------------------------------------
// setCurrencyCookie
// ---------------------------------------------------------------------------

/**
 * Append a `Set-Cookie` header that persists the chosen currency.
 * Throws if `currency` is not a valid 3-letter ISO code.
 *
 * @param {Response} response
 * @param {string}   currency  Must match /^[A-Z]{3}$/
 */
export function setCurrencyCookie(response, currency) {
  if (!CURRENCY_RE.test(currency)) {
    throw new Error(
      `Invalid currency code "${currency}". Must be 3 uppercase letters.`
    );
  }
  response.headers.append(
    'Set-Cookie',
    `currency=${currency}; Path=/; SameSite=Lax; Max-Age=31536000`
  );
}
