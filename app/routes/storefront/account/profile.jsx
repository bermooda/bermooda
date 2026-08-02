import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { handleError } from '#/libs/error/index.server';
import { updateCustomer } from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
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

  try {
    if (intent === 'updateName') {
      const name = formData.get('name');
      if (name) {
        await updateCustomer(customer.id, { name });
      }
    }
  } catch (err) {
    return handleError(err, {
      source: 'storefront.account.profile',
      userMessage: 'Could not update profile.',
    });
  }

  return { success: true };
}

export function meta() {
  return [{ title: 'My Profile' }];
}

export default function AccountProfileRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const themeId = layoutData?.themeId;
  const AccountProfilePage = getStorefrontComponent(
    'AccountProfilePage',
    themeId
  );
  if (!AccountProfilePage) {
    throw new Error('AccountProfilePage theme component not found');
  }
  return <AccountProfilePage {...data} customer={layoutData?.customer} />;
}
