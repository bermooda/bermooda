// app/core/i18n/index.js
// Client-safe i18n exports. No server-only imports.

import { useContext } from 'react';

import { I18nContext } from './context';

/**
 * React hook that returns the `t` translation function from the nearest
 * I18nContext provider.
 *
 * Usage:
 *   const t = useT();
 *   return <p>{t('common.save')}</p>;
 *
 * Falls back to identity (returns the key) when no provider is present.
 *
 * @returns {(key: string, params?: Record<string, string|number>) => string}
 */
export function useT() {
  const { t } = useContext(I18nContext);
  return t;
}

/**
 * Pure translation helper — usable on client and server without hooks.
 * Looks up `key` in `messages`, substitutes `{param}` placeholders.
 *
 * @param {string} key
 * @param {Record<string, string|number>} params
 * @param {Record<string, string>} messages
 * @returns {string}
 */
export function translate(key, params = {}, messages = {}) {
  const value = messages[key];
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
