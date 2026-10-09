// app/core/i18n/locales.js
// Client-safe locale constants and parsing helpers.

import { getCookie } from '#/utils/cookies';

export const DEFAULT_LOCALE = 'en';

/** Locales exposed in the admin UI chrome (locale switcher). */
export const ADMIN_AVAILABLE_LOCALES = ['en', 'de', 'fr'];

/** Full list merchants can enable in Settings → Locales. */
export const LOCALE_OPTIONS = ['en', 'de', 'fr', 'es', 'pt', 'ja'];

export const LOCALE_LABELS = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
};

/**
 * @param {string} locale
 * @returns {boolean}
 */
export function isValidLocaleTag(locale) {
  return (
    typeof locale === 'string' && /^[a-z]{2,8}(-[A-Z]{2,4})?$/.test(locale)
  );
}

/**
 * @param {string} cookieHeader
 * @returns {string|null}
 */
export function parseCookieLocale(cookieHeader) {
  const value = getCookie(cookieHeader, 'locale');
  return value && isValidLocaleTag(value) ? value : null;
}

/** Upper bound on Accept-Language ranges considered (header is client input). */
const MAX_ACCEPT_LANGUAGE_RANGES = 32;

/**
 * Picks the best supported locale for an `Accept-Language` header. Ranges are
 * tried in `q` order (header order breaks ties); each matches a supported
 * locale exactly (`pt-BR`) or by primary subtag (`de-CH` → `de`). `*` and
 * `q=0` ranges are ignored so the caller's default applies.
 *
 * @param {string} acceptLanguage
 * @param {string[]} supportedLocales
 * @returns {string|null}
 */
export function negotiateAcceptLanguage(acceptLanguage, supportedLocales) {
  if (!acceptLanguage || !supportedLocales?.length) return null;

  const ranges = acceptLanguage
    .split(',', MAX_ACCEPT_LANGUAGE_RANGES)
    .map((part, index) => {
      const [tag = '', ...params] = part.split(';');
      const qParam = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((range) => range.tag && range.tag !== '*' && range.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranges) {
    const [primary = '', region] = tag.split(/[-_]/);
    const language = primary.toLowerCase();
    const exact = region ? `${language}-${region.toUpperCase()}` : language;
    if (supportedLocales.includes(exact)) return exact;
    if (supportedLocales.includes(language)) return language;
  }

  return null;
}

/**
 * @param {unknown} locales
 * @param {string[]} [fallback]
 * @returns {string[]}
 */
export function normalizeLocaleList(
  locales,
  fallback = ADMIN_AVAILABLE_LOCALES
) {
  if (!Array.isArray(locales)) return [...fallback];
  const filtered = locales.filter(isValidLocaleTag);
  return filtered.length > 0 ? filtered : [...fallback];
}

/**
 * @param {string|null|undefined} candidate
 * @param {string[]} enabledLocales
 * @param {string} [fallback]
 * @returns {string|null}
 */
export function pickEnabledLocale(
  candidate,
  enabledLocales,
  fallback = DEFAULT_LOCALE
) {
  if (candidate && enabledLocales.includes(candidate)) return candidate;
  if (enabledLocales.includes(fallback)) return fallback;
  return enabledLocales[0] ?? null;
}
