import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import {
  getRegisteredTheme,
  loadThemeSettings,
  preloadStorefrontTheme,
} from '#/core/themes/index.server';

/**
 * @param {Request} request
 * @returns {Promise<{
 *   themeId: string,
 *   locale: string,
 *   currency: string,
 *   themeSettings: Record<string, unknown>,
 * }>}
 */
export async function loadStorefrontPageContext(request) {
  const [themeId, locale, currency] = await Promise.all([
    preloadStorefrontTheme(),
    getRequestLocale(request),
    getRequestCurrency(request),
  ]);
  const manifest = getRegisteredTheme(themeId);
  const themeSettings = manifest ? await loadThemeSettings(manifest) : {};
  return { themeId, locale, currency, themeSettings };
}

/**
 * @param {FormData} formData
 * @param {string} [fallback='/']
 * @returns {string}
 */
export function parseReturnTo(formData, fallback = '/') {
  const returnTo = formData.get('returnTo')?.toString();
  if (!returnTo || !returnTo.startsWith('/')) return fallback;

  // Resolve like a browser would: `/\evil.com` and `/<tab>/evil.com` both
  // become `//evil.com`, so a prefix check alone is an open redirect.
  const base = 'http://return-to.invalid';
  const url = new URL(returnTo, base);
  if (url.origin !== base) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
