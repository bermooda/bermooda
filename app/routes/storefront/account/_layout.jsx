import { redirect } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import { buildLoginRedirectUrl } from '#/libs/auth/shared.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const session = await getCustomerSession(request);

  if (!session?.user) {
    throw redirect(buildLoginRedirectUrl('/account/login', request), 302);
  }

  return { themeId, customer: session.user };
}

export default function AccountLayoutRoute() {
  const { customer, themeId } = useLoaderData();
  const AccountLayout = getStorefrontComponent('AccountLayout', themeId);
  if (!AccountLayout)
    throw new Error('AccountLayout theme component not found');
  return (
    <AccountLayout customer={customer}>
      <Outlet />
    </AccountLayout>
  );
}
