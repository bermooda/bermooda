import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';

import { getRequestCurrency } from '#/core/currency/index.server';
import { listOrders } from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import AccountOrdersPage from '#/themes/default/components/AccountOrdersPage';

export async function loader({ request }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);

  const ordersData = customer
    ? await listOrders(customer.id, { page, limit: 20 })
    : { orders: [], total: 0 };

  return { ordersData, page, locale, currency };
}

export function meta() {
  return [{ title: 'My Orders' }];
}

export default function AccountOrdersRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  return <AccountOrdersPage {...data} customer={layoutData?.customer} />;
}
