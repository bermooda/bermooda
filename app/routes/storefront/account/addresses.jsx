import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import {
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const addresses = customer ? await listAddresses(customer.id) : [];
  return {
    themeId,
    addresses,
    locale,
  };
}

export async function action({ request }) {
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  if (!customer) return { error: 'Not authenticated' };

  const formData = await request.formData();
  const intent = formData.get('intent');
  const addressId = formData.get('addressId');

  const data = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    line1: formData.get('line1'),
    line2: formData.get('line2') || null,
    city: formData.get('city'),
    state: formData.get('state') || null,
    postalCode: formData.get('postalCode'),
    country: formData.get('country'),
    phone: formData.get('phone') || null,
  };

  if (intent === 'add') {
    await addAddress(customer.id, data);
  } else if (intent === 'edit' && addressId) {
    await updateAddress(addressId, customer.id, data);
  } else if (intent === 'delete' && addressId) {
    await deleteAddress(addressId, customer.id);
  } else if (intent === 'setDefault' && addressId) {
    await setDefaultAddress(addressId, customer.id);
  }

  return null;
}

export function meta() {
  return [{ title: 'My Addresses' }];
}

export default function AccountAddressesRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const AccountAddressesPage = getStorefrontComponent(
    'AccountAddressesPage',
    data.themeId
  );
  if (!AccountAddressesPage) {
    throw new Error('AccountAddressesPage theme component not found');
  }
  return <AccountAddressesPage {...data} customer={layoutData?.customer} />;
}
