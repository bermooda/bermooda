// app/core/currency/index.server.js

import { readCookie, serializeCookie } from '#/utils/cookies/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import {
  DEFAULT_CURRENCY,
  SETTING_KEYS,
  get as settingsGet,
  getEnabledCurrencies,
} from '#/core/settings/index.server';

const CURRENCY_RE = /^[A-Z]{3}$/;
const CURRENCY_COOKIE = 'currency';
const CURRENCY_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

// ---------------------------------------------------------------------------
// getRequestCurrency
// ---------------------------------------------------------------------------

/**
 * Resolve the currency for an incoming request.
 * Resolution order (each step only when that currency is enabled):
 *   1. `currency` cookie (the shopper's explicit choice)
 *   2. the request's sales channel currency, for non-default channels
 *   3. `defaultCurrency` setting
 *   4. Hard fallback: 'USD'
 *
 * The cookie is client-controlled, so a code the merchant has not enabled
 * (or has since disabled) must never reach cart creation or checkout. The
 * default channel defers to the shop-wide `defaultCurrency` setting, which
 * is what merchants edit in settings (the seeded default channel is USD).
 *
 * @param {Request} request
 * @returns {Promise<string>} 3-letter ISO currency code
 */
export async function getRequestCurrency(request) {
  const [enabled, channel] = await Promise.all([
    getEnabledCurrencies(),
    resolveChannelFromRequest(request),
  ]);

  const fromCookie = readCookie(request, CURRENCY_COOKIE)?.trim();
  if (
    fromCookie &&
    CURRENCY_RE.test(fromCookie) &&
    enabled.includes(fromCookie)
  ) {
    return fromCookie;
  }

  if (channel && !channel.isDefault && enabled.includes(channel.currency)) {
    return channel.currency;
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
    serializeCookie(CURRENCY_COOKIE, currency, { maxAge: CURRENCY_MAX_AGE })
  );
}
