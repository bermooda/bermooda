// app/core/i18n/index.js
// Client-safe i18n exports. No server-only imports.

import { useContext } from 'react';

import { I18nContext } from '#/core/i18n/context';

export {
  ADMIN_AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_OPTIONS,
  isValidLocaleTag,
  normalizeLocaleList,
  parseAcceptLanguage,
  parseCookieLocale,
  pickEnabledLocale,
} from '#/core/i18n/locales';

/**
 * React hook that returns the `t` translation function from the nearest
 * I18nContext provider.
 *
 * @returns {(key: string, params?: Record<string, string|number>) => string}
 */
export function useT() {
  const { t } = useContext(I18nContext);
  return t;
}

/**
 * Resolves a dot-notation key against a nested messages object.
 * Tries nested traversal first; falls back to flat key lookup.
 *
 * @param {string} key
 * @param {Record<string, any>} messages
 * @returns {string|undefined}
 */
export function resolveMessageKey(key, messages) {
  if (!key || !messages) return undefined;

  const parts = key.split('.');
  let current = messages;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      current = undefined;
      break;
    }
    current = current[part];
  }

  if (typeof current === 'string') return current;

  return typeof messages[key] === 'string' ? messages[key] : undefined;
}

/**
 * Pure translation helper — usable on client and server without hooks.
 *
 * @param {string} key
 * @param {Record<string, string|number>} params
 * @param {Record<string, any>} messages
 * @returns {string}
 */
export function translate(key, params = {}, messages = {}) {
  const value = resolveMessageKey(key, messages);

  if (typeof value !== 'string') return key;

  if (params && Object.keys(params).length > 0) {
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(params, name)
        ? String(params[name])
        : `{${name}}`
    );
  }

  return value;
}
