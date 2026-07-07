// Shared helpers for storefront route modules (HTML surface, not REST JSON).

import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';

/**
 * Load theme, locale, and currency for a storefront page loader.
 *
 * @param {Request} request
 * @returns {Promise<{ themeId: string, locale: string, currency: string }>}
 */
export async function loadStorefrontPageContext(request) {
  const [themeId, locale, currency] = await Promise.all([
    preloadStorefrontTheme(),
    getRequestLocale(request),
    getRequestCurrency(request),
  ]);

  return { themeId, locale, currency };
}

/**
 * Parse a safe same-origin return path from form data.
 *
 * @param {FormData} formData
 * @param {string} [fallback='/']
 * @returns {string}
 */
export function parseReturnTo(formData, fallback = '/') {
  const returnTo = formData.get('returnTo')?.toString();
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return fallback;
  }
  return returnTo;
}
