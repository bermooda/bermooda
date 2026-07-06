import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import { updateCustomer } from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  return {
    themeId,
    locale,
  };
}

export async function action({ request }) {
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  if (!customer) return { error: 'Not authenticated' };

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'updateName') {
    const name = formData.get('name');
    if (name) {
      await updateCustomer(customer.id, { name });
    }
  }

  return { success: true };
}

export function meta() {
  return [{ title: 'My Profile' }];
}

export default function AccountProfileRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const themeId = layoutData?.themeId ?? 'default';
  const AccountProfilePage = getStorefrontComponent(
    'AccountProfilePage',
    themeId
  );
  if (!AccountProfilePage) {
    throw new Error('AccountProfilePage theme component not found');
  }
  return <AccountProfilePage {...data} customer={layoutData?.customer} />;
}
