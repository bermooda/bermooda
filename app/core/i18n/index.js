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
