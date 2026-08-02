import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { getOrder } from '#/core/customers/index.server';
import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request, params }) {
  const { themeId, locale, currency } =
    await loadStorefrontPageContext(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const order = customer ? await getOrder(params.id, customer.id) : null;

  return {
    themeId,
    orderId: params.id,
    order,
    locale,
    currency,
  };
}

export function meta() {
  return [{ title: 'Order Detail' }];
}

export default function AccountOrderDetailRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const AccountOrderDetailPage = getStorefrontComponent(
    'AccountOrderDetailPage',
    layoutData?.themeId ?? data.themeId
  );
  if (!AccountOrderDetailPage) {
    throw new Error('AccountOrderDetailPage theme component not found');
  }
  return <AccountOrderDetailPage {...data} customer={layoutData?.customer} />;
}
