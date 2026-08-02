import { redirect, useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { buildLoginRedirectUrl } from '#/libs/auth/shared/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import {
  getCustomerLoyaltySummary,
  getOrCreateReferralCode,
  listLoyaltyTransactions,
} from '#/core/loyalty/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const session = await getCustomerSession(request);
  if (!session?.user) {
    throw redirect(buildLoginRedirectUrl('/account/login', request), 302);
  }

  const customerId = session.user.id;
  const [themeId, locale, currency, loyalty, { transactions }, referralCode] =
    await Promise.all([
      preloadStorefrontTheme(),
      getRequestLocale(request),
      getRequestCurrency(request),
      getCustomerLoyaltySummary(customerId),
      listLoyaltyTransactions(customerId, { limit: 20 }),
      getOrCreateReferralCode(customerId),
    ]);

  return {
    themeId,
    locale,
    currency,
    config: loyalty.config,
    balance: loyalty.balance,
    valueCents: loyalty.valueCents,
    transactions,
    referralCode: referralCode.code,
  };
}

export function meta() {
  return [{ title: 'Loyalty Rewards' }];
}

export default function AccountLoyaltyRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const themeId = layoutData?.themeId ?? data.themeId;
  const AccountLoyaltyPage = getStorefrontComponent(
    'AccountLoyaltyPage',
    themeId
  );
  if (!AccountLoyaltyPage) {
    throw new Error('AccountLoyaltyPage theme component not found');
  }
  return <AccountLoyaltyPage {...data} customer={layoutData?.customer} />;
}
