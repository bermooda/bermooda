import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';

import { listOrders } from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import AccountDashboard from '#/themes/default/components/AccountDashboard';

export async function loader({ request }) {
  const locale = await getRequestLocale(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const recentOrdersResult = customer
    ? await listOrders(customer.id, { page: 1, limit: 5 })
    : { orders: [] };

  return { recentOrders: recentOrdersResult.orders, locale };
}

export function meta() {
  return [{ title: 'My Account' }];
}

export default function AccountIndexRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account._layout');
  return <AccountDashboard {...data} customer={layoutData?.customer} />;
}
