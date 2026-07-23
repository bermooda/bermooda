import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { handleError } from '#/libs/error/index.server';
import { parseAddressInput } from '#/core/address-validation/index.server';
import {
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '#/core/customers/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components/index';

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

  const data = parseAddressInput(formData);

  try {
    if (intent === 'add') {
      await addAddress(customer.id, data);
    } else if (intent === 'edit' && addressId) {
      await updateAddress(addressId, customer.id, data);
    } else if (intent === 'delete' && addressId) {
      await deleteAddress(addressId, customer.id);
    } else if (intent === 'setDefault' && addressId) {
      await setDefaultAddress(addressId, customer.id);
    }
  } catch (err) {
    return handleError(err, {
      source: 'storefront.account.addresses',
      userMessage: 'Could not update address.',
    });
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
