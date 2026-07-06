/**
 * Storefront layout — pathless wrapper for all storefront routes.
 *
 * Provides:
 * - i18n context (locale + translated messages via I18nContext)
 * - locale + currency + available options passed to child routes
 * - navigation menus for theme chrome
 */
import { Outlet, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import { getMenuByHandle } from '#/core/content/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { I18nContext } from '#/core/i18n/context';
import { translate } from '#/core/i18n/index';
import {
  getAvailableLocales,
  loadMessages,
  resolveRequestLocale,
} from '#/core/i18n/index.server';
import { trackReferral } from '#/core/loyalty/index.server';
import { get as settingsGet } from '#/core/settings/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';

export async function loader({ request }) {
  const headers = new Headers();
  const locale = await resolveRequestLocale(request, headers);
  const channel = await resolveChannelFromRequest(request);
  const currency =
    (await getRequestCurrency(request)) ?? channel.currency ?? 'USD';

  const url = new URL(request.url);
  const refCode = url.searchParams.get('ref');
  const cookie = request.headers.get('cookie') ?? '';
  const refCookieMatch = cookie.match(/(?:^|;\s*)bermooda_ref=([^;]+)/);
  const cookieRef = refCookieMatch
    ? decodeURIComponent(refCookieMatch[1].trim())
    : null;
  const effectiveRef = refCode ?? cookieRef;
  const session = await getCustomerSession(request);

  if (effectiveRef && session?.user?.id) {
    try {
      await trackReferral(effectiveRef, session.user.id);
    } catch {
      // Self-referral or invalid code — ignore
    }
  }

  const [
    messages,
    currencies,
    availableLocales,
    mainMenu,
    footerMenu,
    subHeaderMenu,
    slotBlocks,
  ] = await Promise.all([
    loadMessages(locale),
    settingsGet('currencies'),
    getAvailableLocales(),
    getMenuByHandle('main', { locale }),
    getMenuByHandle('footer', { locale }),
    getMenuByHandle('sub-header', { locale }),
    getSlotBlocksMap(['layout.header', 'layout.footer']),
  ]);
  const availableCurrencies = Array.isArray(currencies)
    ? currencies
    : ['USD', 'EUR', 'AUD'];

  if (refCode) {
    headers.append(
      'Set-Cookie',
      `bermooda_ref=${encodeURIComponent(refCode.trim().toUpperCase())}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`
    );
  }

  return Response.json(
    {
      locale,
      currency,
      channel: {
        id: channel.id,
        handle: channel.handle,
        name: channel.name,
        locale: channel.locale,
      },
      messages,
      availableLocales,
      availableCurrencies,
      menus: {
        main: mainMenu?.items ?? [],
        footer: footerMenu?.items ?? [],
        subHeader: subHeaderMenu?.items ?? [],
      },
      slotBlocks,
    },
    { headers }
  );
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
