// app/emails/i18n.server.js
// Flat-key message catalogs for shop transactional emails.

import { translate } from '#/core/i18n';

/**
 * Email catalogs are eager-imported so they ship inside the SSR bundle.
 * Production `react-router-serve` runs from `build/server/index.js`, where
 * `import.meta.url`-relative `./i18n` paths do not exist on disk.
 *
 * @type {Record<string, Record<string, string>>}
 */
const EMAIL_CATALOGS = import.meta.glob('./i18n/*.json', {
  eager: true,
  import: 'default',
});

/** @type {Map<string, Record<string, string>>} */
const cache = new Map();

/**
 * Reads a locale JSON catalog. Missing catalogs yield an empty object.
 *
 * @param {string} locale
 * @returns {Record<string, string>}
 */
function readLocaleFile(locale) {
  const catalog = EMAIL_CATALOGS[`./i18n/${locale}.json`];
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return {};
  }
  return { ...catalog };
}

/**
 * Loads email message catalogs for the given locale.
 * Flat keys from `en.json` are the base; the requested locale overlays them.
 *
 * @param {string} [locale]
 * @returns {Record<string, string>}
 */
export function loadEmailMessages(locale = 'en') {
  const tag = typeof locale === 'string' && locale ? locale : 'en';
  const cached = cache.get(tag);
  if (cached) return cached;

  const en = readLocaleFile('en');
  const merged = tag === 'en' ? { ...en } : { ...en, ...readLocaleFile(tag) };

  cache.set(tag, merged);
  return merged;
}

/**
 * Returns a `t(key, params?)` helper bound to the email catalog for `locale`.
 *
 * @param {string} [locale]
 * @returns {(key: string, params?: Record<string, string|number>) => string}
 */
export function emailT(locale = 'en') {
  const messages = loadEmailMessages(locale);
  return (key, params = {}) => translate(key, params, messages);
}

/**
 * Clears the in-memory catalog cache (for tests).
 */
export function clearEmailMessagesCache() {
  cache.clear();
}
