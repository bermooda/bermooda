import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';

import { getRequestCurrency } from '#/core/currency/index.server';
import { getOrder } from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import AccountOrderDetailPage from '#/themes/default/components/AccountOrderDetailPage';

export async function loader({ request, params }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const order = customer ? await getOrder(params.id, customer.id) : null;

  return { orderId: params.id, order, locale, currency };
}

export function meta() {
  return [{ title: 'Order Detail' }];
}

export default function AccountOrderDetailRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  return <AccountOrderDetailPage {...data} customer={layoutData?.customer} />;
}
