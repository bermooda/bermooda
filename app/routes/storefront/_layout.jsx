/**
 * Storefront layout — pathless wrapper for all storefront routes.
 *
 * Provides:
 * - i18n context (locale + translated messages via I18nContext)
 * - locale + currency + available options passed to child routes
 * - navigation menus for theme chrome
 */
import { Outlet, useLoaderData } from 'react-router';

import { getMenuByHandle } from '#/core/content/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { I18nContext } from '#/core/i18n/context';
import { translate } from '#/core/i18n/index';
import { getRequestLocale, loadMessages } from '#/core/i18n/index.server';
import { get as settingsGet } from '#/core/settings/index.server';

export async function loader({ request }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);

  const [messages, currencies, mainMenu, footerMenu, subHeaderMenu] =
    await Promise.all([
      loadMessages(locale),
      settingsGet('currencies'),
      getMenuByHandle('main', { locale }),
      getMenuByHandle('footer', { locale }),
      getMenuByHandle('sub-header', { locale }),
    ]);

  const availableLocales = ['en', 'de', 'fr'];
  const availableCurrencies = Array.isArray(currencies)
    ? currencies
    : ['USD', 'EUR', 'AUD'];

  return {
    locale,
    currency,
    messages,
    availableLocales,
    availableCurrencies,
    menus: {
      main: mainMenu?.items ?? [],
      footer: footerMenu?.items ?? [],
      subHeader: subHeaderMenu?.items ?? [],
    },
  };
}

export default function StorefrontLayout() {
  const { messages } = useLoaderData();

  function t(key, params) {
    return translate(key, params, messages);
  }

  return (
    <I18nContext.Provider value={{ t }}>
      <Outlet />
    </I18nContext.Provider>
  );
}
