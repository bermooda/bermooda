/**
 * Storefront layout — pathless wrapper for all storefront routes.
 *
 * Provides:
 * - i18n context (locale + translated messages via I18nContext)
 * - locale + currency + available options passed to child routes
 * - navigation menus for theme chrome
 */
import { Outlet, useLoaderData } from 'react-router';

import { readCookie, serializeCookie } from '#/utils/cookies/index.server';
import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';
import { getMenuByHandle } from '#/core/content/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { useI18nValue } from '#/core/i18n';
import { I18nContext } from '#/core/i18n/context';
import {
  loadStorefrontMessages,
  resolveLocale,
} from '#/core/i18n/index.server';
import {
  normalizeReferralCode,
  settleReferral,
} from '#/core/loyalty/index.server';
import {
  getEnabledCurrencies,
  getEnabledLocales,
} from '#/core/settings/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';

const REF_COOKIE = 'bermooda_ref';
const REF_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function loader({ request }) {
  const headers = new Headers();
  const locale = await resolveLocale(request, headers);
  const channel = await resolveChannelFromRequest(request);
  const currency = await getRequestCurrency(request);

  const url = new URL(request.url);
  const refParam = url.searchParams.get('ref')?.trim();
  const refCode = refParam ? normalizeReferralCode(refParam) : null;
  const cookieRef = readCookie(request, REF_COOKIE);
  const effectiveRef = refCode ?? cookieRef;
  const session = await getCustomerSession(request);

  // Track once per signed-in customer, then drop the cookie so later page
  // views skip the loyalty lookup. Guests keep the cookie until they sign in.
  const referralSettled =
    effectiveRef && session?.user?.id
      ? await settleReferral(effectiveRef, session.user.id)
      : false;

  const [
    messages,
    availableCurrencies,
    availableLocales,
    mainMenu,
    footerMenu,
    subHeaderMenu,
    slotBlocks,
  ] = await Promise.all([
    loadStorefrontMessages(locale),
    getEnabledCurrencies(),
    getEnabledLocales(),
    getMenuByHandle('main', { locale }),
    getMenuByHandle('footer', { locale }),
    getMenuByHandle('sub-header', { locale }),
    getSlotBlocksMap(['layout.header', 'layout.footer']),
  ]);

  if (referralSettled) {
    if (cookieRef) {
      headers.append(
        'Set-Cookie',
        serializeCookie(REF_COOKIE, '', { maxAge: 0 })
      );
    }
  } else if (refCode) {
    headers.append(
      'Set-Cookie',
      serializeCookie(REF_COOKIE, refCode, {
        maxAge: REF_MAX_AGE,
        httpOnly: true,
      })
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
  const { locale, messages } = useLoaderData();
  const i18n = useI18nValue(locale, messages);

  return (
    <I18nContext.Provider value={i18n}>
      <Outlet />
    </I18nContext.Provider>
  );
}
