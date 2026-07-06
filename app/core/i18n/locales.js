// app/core/i18n/locales.js
// Client-safe locale constants and parsing helpers.

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
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.split('=');
    const name = rawName.trim();
    if (name === 'locale') {
      const value = rest.join('=').trim();
      return value && isValidLocaleTag(value) ? value : null;
    }
  }

  return null;
}

/**
 * @param {string} acceptLanguage
 * @returns {string|null}
 */
export function parseAcceptLanguage(acceptLanguage) {
  if (!acceptLanguage) return null;

  const first = acceptLanguage.split(',')[0].trim();
  const tag = first.split(';')[0].trim();
  const primary = tag.split('-')[0].split('_')[0].toLowerCase();

  return primary && isValidLocaleTag(primary) ? primary : null;
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
