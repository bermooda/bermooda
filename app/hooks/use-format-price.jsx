import { useCallback } from 'react';

import { formatPrice } from '#/core/currency/format';
import { useLocale } from '#/core/i18n';

/**
 * `formatPrice` bound to the active UI locale from I18nContext, so admin
 * and storefront amounts follow the viewer's language.
 *
 * @returns {(cents: number, currency?: string) => string}
 */
export default function useFormatPrice() {
  const locale = useLocale();
  return useCallback(
    (cents, currency) => formatPrice(cents, currency, locale),
    [locale]
  );
}
