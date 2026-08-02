import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { listOrders } from '#/core/customers/index.server';
import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const { themeId, locale, currency } =
    await loadStorefrontPageContext(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);

  const ordersData = customer
    ? await listOrders(customer.id, { page, limit: 20 })
    : { orders: [], total: 0 };

  return {
    themeId,
    ordersData,
    page,
    locale,
    currency,
  };
}

export function meta() {
  return [{ title: 'My Orders' }];
}

export default function AccountOrdersRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const themeId = layoutData?.themeId;
  const AccountOrdersPage = getStorefrontComponent(
    'AccountOrdersPage',
    themeId
  );
  if (!AccountOrdersPage) {
    throw new Error('AccountOrdersPage theme component not found');
  }
  return <AccountOrdersPage {...data} customer={layoutData?.customer} />;
}
