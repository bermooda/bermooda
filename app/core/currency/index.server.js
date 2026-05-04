// app/core/currency/index.server.js

import prisma from '#/libs/prisma.server';

import { get as settingsGet } from '#/core/settings/index.server';

// ---------------------------------------------------------------------------
// getRequestCurrency
// ---------------------------------------------------------------------------

/**
 * Resolve the currency for an incoming request.
 * Resolution order:
 *   1. `currency` cookie value
 *   2. `defaultCurrency` setting
 *   3. Hard fallback: 'USD'
 *
 * @param {Request} request
 * @returns {Promise<string>} 3-letter ISO currency code
 */
export async function getRequestCurrency(request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)currency=([^;]+)/);
  if (match) {
    return match[1].trim();
  }

  const fromSettings = await settingsGet('defaultCurrency');
  if (fromSettings) return fromSettings;

  return 'USD';
}

// ---------------------------------------------------------------------------
// lookupVariantPrice
// ---------------------------------------------------------------------------

/**
 * Exact-match price lookup. Returns null when no row exists for the given
 * variantId + currency combination.
 *
 * @param {string} variantId
 * @param {string} currency  3-letter ISO code
 * @returns {Promise<{ priceCents: number, compareAtCents: number|null, currency: string }|null>}
 */
export async function lookupVariantPrice(variantId, currency) {
  const row = await prisma.variantPrice.findUnique({
    where: { variantId_currency: { variantId, currency } },
  });
  return row
    ? {
        priceCents: row.priceCents,
        compareAtCents: row.compareAtCents ?? null,
        currency: row.currency,
      }
    : null;
}

// ---------------------------------------------------------------------------
// lookupVariantPriceForBrowsing
// ---------------------------------------------------------------------------

/**
 * Try exact match; fall back to the shop's defaultCurrency when not found.
 * Attaches an `isFallback` flag so callers can surface "shown in USD" notices.
 *
 * @param {string} variantId
 * @param {string} currency  Requested 3-letter ISO code
 * @returns {Promise<{ priceCents: number, compareAtCents: number|null, currency: string, isFallback: boolean }|null>}
 */
export async function lookupVariantPriceForBrowsing(variantId, currency) {
  const exact = await lookupVariantPrice(variantId, currency);
  if (exact) return { ...exact, isFallback: false };

  const defaultCurrency = (await settingsGet('defaultCurrency')) ?? 'USD';
  const fallback = await lookupVariantPrice(variantId, defaultCurrency);
  if (fallback) return { ...fallback, isFallback: true };

  return null;
}

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------

/**
 * Format a price given in cents as a localised currency string.
 *
 * @param {number} cents
 * @param {string} [currency='USD']
 * @param {string} [locale='en']
 * @returns {string}
 */
export function formatPrice(cents, currency = 'USD', locale = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

// ---------------------------------------------------------------------------
// setCurrencyCookie
// ---------------------------------------------------------------------------

const CURRENCY_RE = /^[A-Z]{3}$/;

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
    `currency=${currency}; Path=/; SameSite=Lax`
  );
}
