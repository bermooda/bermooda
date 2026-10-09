// app/core/i18n/index.server.js
// Server-side i18n resolver: locale negotiation, message catalog merging,
// translation lookup, and cookie helpers.

import { readFileSync } from 'fs';
import { join } from 'path';

import { getCachedResult } from '#/utils/cache/index.server';
import { serializeCookie } from '#/utils/cookies/index.server';
import logger from '#/utils/logger.server';
import { getCustomerSession } from '#/libs/auth/customer/index.server';
import prisma from '#/libs/prisma.server';
import {
  ADMIN_AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  isValidLocaleTag,
  negotiateAcceptLanguage,
  parseCookieLocale,
  pickEnabledLocale,
} from '#/core/i18n/locales';
import { getRegisteredPlugin } from '#/core/plugins/index.server';
import {
  getEnabledLocales,
  get as settingsGet,
} from '#/core/settings/index.server';
import { getRegisteredTheme } from '#/core/themes/index.server';

/**
 * Keys under this namespace are admin UI strings. They are dropped from the
 * storefront payload (see `loadStorefrontMessages`).
 */
const ADMIN_NAMESPACE = 'admin';

/** Keys that could rewrite the merged catalog's prototype chain. */
const UNSAFE_MERGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Core message catalogs are eager-imported so they ship inside the SSR
 * bundle. Production `react-router-serve` runs `build/server/index.js`, where
 * `import.meta.url`-relative paths to `app/core/i18n/messages` resolve outside
 * the shop (and Docker images may omit source trees entirely).
 *
 * @type {Record<string, Record<string, any>>}
 */
const CORE_CATALOGS = import.meta.glob('./messages/*.json', {
  eager: true,
  import: 'default',
});

/**
 * Shop `app/` directory for theme/plugin catalog overlays on disk.
 * Always resolve from `process.cwd()` (shop root) — not from
 * `import.meta.url` — because the production SSR bundle lives under
 * `build/server/`.
 */
const APP_DIR = join(process.cwd(), 'app');

/**
 * Loads a bundled core message catalog for `locale`.
 *
 * @param {string} locale
 * @returns {Record<string, any>}
 */
function loadCoreCatalog(locale) {
  const catalog = CORE_CATALOGS[`./messages/${locale}.json`];
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return {};
  }
  return { ...catalog };
}

/**
 * Builds theme/plugin catalog file paths for a locale (core catalogs are bundled).
 *
 * @param {string} locale
 * @param {string | null} themeSlug
 * @param {string[]} pluginSlugs
 * @returns {string[]}
 */
function extensionCatalogPathsForLocale(locale, themeSlug, pluginSlugs) {
  return [
    ...(themeSlug
      ? [join(APP_DIR, 'themes', themeSlug, 'i18n', `${locale}.json`)]
      : []),
    ...pluginSlugs.map((slug) =>
      join(APP_DIR, 'plugins', slug, 'i18n', `${locale}.json`)
    ),
  ];
}

/**
 * Deep-merges JSON catalogs from the given paths. Missing files (ENOENT) are
 * skipped silently; unreadable, invalid, or non-object catalogs are logged and
 * skipped so one broken theme/plugin file can't take down every page.
 *
 * @param {string[]} filePaths
 * @param {Record<string, any>} [base]
 * @returns {Record<string, any>}
 */
function mergeCatalogFiles(filePaths, base = {}) {
  let merged = base;
  for (const filePath of filePaths) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.error({ filePath, err }, 'Skipping unreadable i18n catalog');
      }
      continue;
    }
    if (!isPlainCatalog(parsed)) {
      logger.error({ filePath }, 'Skipping i18n catalog that is not an object');
      continue;
    }
    merged = deepMerge(merged, parsed);
  }
  return merged;
}

/**
 * Loads and merges message catalogs for the given locale from core, theme,
 * and enabled plugin sources. Non-English locales deep-merge on top of an
 * English base so missing keys fall back to en. Missing files are skipped.
 * Result is TTL-cached under `i18n:${locale}` (bust with `invalidateCachePrefix('i18n:')`
 * when the active theme or enabled plugins change).
 *
 * Merge order: core en → theme/plugin en → core locale → theme/plugin locale.
 *
 * @param {string} locale
 * @returns {Promise<Record<string, any>>}
 */
export async function loadMessages(locale) {
  return getCachedResult(`i18n:${locale}`, async () => {
    const [activeThemeId, pluginOrderRaw, enabledRaw] = await Promise.all([
      settingsGet('activeTheme'),
      settingsGet('pluginOrder'),
      settingsGet('enabledPlugins'),
    ]);

    const themeSlug =
      typeof activeThemeId === 'string'
        ? (getRegisteredTheme(activeThemeId)?.slug ?? null)
        : null;

    const enabledSet = new Set(Array.isArray(enabledRaw) ? enabledRaw : []);
    const pluginIds = (
      Array.isArray(pluginOrderRaw) ? pluginOrderRaw : []
    ).filter((id) => enabledSet.has(id));
    const pluginSlugs = pluginIds
      .map((id) => getRegisteredPlugin(id)?.slug)
      .filter(Boolean);

    let merged = loadCoreCatalog('en');
    merged = mergeCatalogFiles(
      extensionCatalogPathsForLocale('en', themeSlug, pluginSlugs),
      merged
    );

    if (locale !== 'en') {
      merged = deepMerge(merged, loadCoreCatalog(locale));
      merged = mergeCatalogFiles(
        extensionCatalogPathsForLocale(locale, themeSlug, pluginSlugs),
        merged
      );
    }

    return merged;
  });
}

/**
 * Loads the catalog for storefront pages: `loadMessages` without the
 * `admin.*` namespace (flat `admin.x` keys or a nested `admin` object). The
 * storefront layout serializes this into every page and every revalidation,
 * and admin strings are nearly all of the core catalog. Cached under
 * `i18n:storefront:${locale}`, so `invalidateCachePrefix('i18n:')` busts it too.
 *
 * @param {string} locale
 * @returns {Promise<Record<string, any>>}
 */
export async function loadStorefrontMessages(locale) {
  return getCachedResult(`i18n:storefront:${locale}`, async () => {
    const messages = await loadMessages(locale);
    return Object.fromEntries(
      Object.entries(messages).filter(
        ([key]) =>
          key !== ADMIN_NAMESPACE && !key.startsWith(`${ADMIN_NAMESPACE}.`)
      )
    );
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
    getEnabledLocales(),
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

  const negotiatedLocale = negotiateAcceptLanguage(
    request.headers.get('accept-language') ?? '',
    enabledLocales
  );
  return negotiatedLocale ?? fallbackLocale;
}

/**
 * Resolves the admin UI locale. Admin chrome ships catalogs for
 * `ADMIN_AVAILABLE_LOCALES`, independent of which locales the storefront
 * enables, and never consults the customer session:
 *   1. `locale` cookie (when an admin locale)
 *   2. Accept-Language (when an admin locale)
 *   3. `defaultLocale` setting (when an admin locale)
 *   4. `DEFAULT_LOCALE`
 *
 * @param {Request} request
 * @returns {Promise<string>}
 */
export async function getAdminRequestLocale(request) {
  const cookieLocale = parseCookieLocale(request.headers.get('cookie') ?? '');
  if (cookieLocale && ADMIN_AVAILABLE_LOCALES.includes(cookieLocale)) {
    return cookieLocale;
  }

  const negotiatedLocale = negotiateAcceptLanguage(
    request.headers.get('accept-language') ?? '',
    ADMIN_AVAILABLE_LOCALES
  );
  if (negotiatedLocale) return negotiatedLocale;

  return (
    pickEnabledLocale(
      await settingsGet('defaultLocale'),
      ADMIN_AVAILABLE_LOCALES,
      DEFAULT_LOCALE
    ) ?? DEFAULT_LOCALE
  );
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
    serializeCookie('locale', locale, { maxAge: 365 * 24 * 60 * 60 })
  );
}

/**
 * Resolves the storefront request locale and persists it in a cookie when absent.
 *
 * @param {Request} request
 * @param {Headers} headers - response headers to append `Set-Cookie` to
 * @returns {Promise<string>}
 */
export async function resolveLocale(request, headers) {
  const cookieLocale = parseCookieLocale(request.headers.get('cookie') ?? '');
  const locale = await getRequestLocale(request);
  if (!cookieLocale) {
    appendLocaleCookie(headers, locale);
  }
  return locale;
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

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainCatalog(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep-merges `source` onto a copy of `target`. Skips `__proto__` /
 * `constructor` / `prototype` keys (JSON.parse keeps `__proto__` as an own key).
 *
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 * @returns {Record<string, any>}
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (UNSAFE_MERGE_KEYS.has(key)) continue;
    if (isPlainCatalog(value) && isPlainCatalog(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
