import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import { listOrders } from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { getSlotBlocksMap } from '#/core/themes/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const recentOrdersResult = customer
    ? await listOrders(customer.id, { page: 1, limit: 5 })
    : { orders: [] };
  const slotBlocks = await getSlotBlocksMap(['account.dashboard']);

  return {
    themeId,
    recentOrders: recentOrdersResult.orders,
    locale,
    slotBlocks,
  };
}

export function meta() {
  return [{ title: 'My Account' }];
}

export default function AccountIndexRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const themeId = layoutData?.themeId ?? 'default';
  const AccountDashboard = getStorefrontComponent('AccountDashboard', themeId);
  if (!AccountDashboard) {
    throw new Error('AccountDashboard theme component not found');
  }
  return <AccountDashboard {...data} customer={layoutData?.customer} />;
}
