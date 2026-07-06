// app/core/i18n/index.server.js
// Server-side i18n resolver: locale negotiation, message catalog merging,
// translation lookup, and cookie helpers.

import { readFileSync } from 'fs';
import { join } from 'path';

import { getCachedResult } from '#/utils/cache.server';
import { getCustomerSession } from '#/libs/auth/customer.server';
import prisma from '#/libs/prisma.server';
import {
  DEFAULT_LOCALE,
  isValidLocaleTag,
  normalizeLocaleList,
  parseAcceptLanguage,
  parseCookieLocale,
  pickEnabledLocale,
} from '#/core/i18n/locales';
import { get as settingsGet } from '#/core/settings/index.server';

export { translate as t } from '#/core/i18n/index';

const APP_DIR = new URL('../../../app', import.meta.url).pathname;

/**
 * Returns storefront-enabled locales from settings.
 *
 * @returns {Promise<string[]>}
 */
export async function getAvailableLocales() {
  const locales = await settingsGet('locales');
  return normalizeLocaleList(locales);
}

/**
 * Loads and merges message catalogs for the given locale from core, theme,
 * and enabled plugin sources. Missing files are skipped. Result is TTL-cached.
 *
 * @param {string} locale
 * @returns {Promise<Record<string, any>>}
 */
export async function loadMessages(locale) {
  return getCachedResult(`i18n:${locale}`, async () => {
    const [activeTheme, pluginOrder] = await Promise.all([
      settingsGet('activeTheme'),
      settingsGet('pluginOrder'),
    ]);

    const plugins = Array.isArray(pluginOrder) ? pluginOrder : [];
    const theme = activeTheme ?? null;

    const filePaths = [
      join(APP_DIR, 'core', 'i18n', 'messages', `${locale}.json`),
      ...(theme
        ? [join(APP_DIR, 'themes', theme, 'i18n', `${locale}.json`)]
        : []),
      ...plugins.map((pluginId) =>
        join(APP_DIR, 'plugins', pluginId, 'i18n', `${locale}.json`)
      ),
    ];

    let merged = {};
    for (const filePath of filePaths) {
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        merged = deepMerge(merged, parsed);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }

    return merged;
  });
}

/**
 * Resolves the locale for an incoming request:
 *   1. `locale` cookie (when enabled)
 *   2. Customer preferredLocale (logged-in, no cookie)
 *   3. Accept-Language (when enabled)
 *   4. `defaultLocale` setting
 *
 * @param {Request} request
 * @returns {Promise<string>}
 */
export async function getRequestLocale(request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const [defaultLocaleSetting, enabledLocales] = await Promise.all([
    settingsGet('defaultLocale'),
    getAvailableLocales(),
  ]);
  const fallbackLocale =
    pickEnabledLocale(
      defaultLocaleSetting ?? DEFAULT_LOCALE,
      enabledLocales,
      DEFAULT_LOCALE
    ) ?? DEFAULT_LOCALE;

  const cookieLocale = parseCookieLocale(cookieHeader);
  if (cookieLocale && enabledLocales.includes(cookieLocale)) {
    return cookieLocale;
  }

  const sessionLocale = await getCustomerPreferredLocale(request);
  if (sessionLocale && enabledLocales.includes(sessionLocale)) {
    return sessionLocale;
  }

  const acceptLanguage = request.headers.get('accept-language') ?? '';
  const negotiatedLocale = parseAcceptLanguage(acceptLanguage);
  if (negotiatedLocale && enabledLocales.includes(negotiatedLocale)) {
    return negotiatedLocale;
  }

  return fallbackLocale;
}

/**
 * Appends a locale cookie to a Headers instance when the tag is valid.
 *
 * @param {Headers} headers
 * @param {string} locale
 */
export function appendLocaleCookie(headers, locale) {
  if (!isValidLocaleTag(locale)) return;
  headers.append(
    'Set-Cookie',
    `locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`
  );
}

/**
 * Appends a locale cookie to a Response when the tag is valid.
 *
 * @param {Response} response
 * @param {string} locale
 */
export function setLocaleCookie(response, locale) {
  appendLocaleCookie(response.headers, locale);
}

/**
 * Resolves request locale and persists it in a cookie when absent.
 *
 * @param {Request} request
 * @param {Response|Headers} target
 * @returns {Promise<string>}
 */
export async function resolveLocale(request, target) {
  const cookieLocale = parseCookieLocale(request.headers.get('cookie') ?? '');
  const locale = await getRequestLocale(request);
  if (!cookieLocale) {
    const headers = target instanceof Response ? target.headers : target;
    appendLocaleCookie(headers, locale);
  }
  return locale;
}

/**
 * Resolves request locale and persists it via response headers when absent.
 *
 * @param {Request} request
 * @param {Headers} headers
 * @returns {Promise<string>}
 */
export async function resolveRequestLocale(request, headers) {
  return resolveLocale(request, headers);
}

async function getCustomerPreferredLocale(request) {
  const session = await getCustomerSession(request);
  if (!session?.user?.id) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: session.user.id },
    select: { preferredLocale: true },
  });

  const locale = customer?.preferredLocale;
  return locale && isValidLocaleTag(locale) ? locale : null;
}

function deepMerge(target, source) {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
