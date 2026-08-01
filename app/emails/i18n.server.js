// app/emails/i18n.server.js
// Flat-key message catalogs for shop transactional emails.

import { readFileSync } from 'fs';
import { join } from 'path';

import { translate } from '#/core/i18n';

const I18N_DIR = new URL('./i18n', import.meta.url).pathname;

/** @type {Map<string, Record<string, string>>} */
const cache = new Map();

/**
 * Reads a locale JSON catalog. Missing files yield an empty object.
 *
 * @param {string} locale
 * @returns {Record<string, string>}
 */
function readLocaleFile(locale) {
  const filePath = join(I18N_DIR, `${locale}.json`);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? /** @type {Record<string, string>} */ (parsed)
      : {};
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'ENOENT'
    ) {
      return {};
    }
    throw err;
  }
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
