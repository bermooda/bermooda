// app/routes/storefront/account/wishlist.jsx

import { useLoaderData, useRouteLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';
import {
  addToWishlist,
  listWishlistItems,
  mapWishlistActionError,
  parseWishlistFromForm,
  removeFromWishlist,
} from '#/core/wishlists/index.server';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const locale = await getRequestLocale(request);
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;

  const itemsData = customer
    ? await listWishlistItems({
        customerId: customer.id,
        limit: 100,
        locale,
      })
    : { items: [], total: 0 };

  return {
    themeId,
    itemsData,
    locale,
  };
}

export async function action({ request }) {
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  if (!customer) return { ok: false, error: 'Not authenticated' };

  const formData = await request.formData();

  try {
    const { variantId, intent } = parseWishlistFromForm(formData, {
      customerId: customer.id,
    });

    if (intent === 'add') {
      await addToWishlist(customer.id, variantId);
      return { ok: true };
    }

    await removeFromWishlist(customer.id, variantId);
    return { ok: true };
  } catch (err) {
    return mapWishlistActionError(err, { style: 'account' });
  }
}

export function meta() {
  return [{ title: 'Wishlist' }];
}

export default function AccountWishlistRoute() {
  const data = useLoaderData();
  const layoutData = useRouteLoaderData('routes/storefront/account/_layout');
  const themeId = layoutData?.themeId ?? 'default';
  const AccountWishlistPage = getStorefrontComponent(
    'AccountWishlistPage',
    themeId
  );
  if (!AccountWishlistPage) {
    throw new Error('AccountWishlistPage theme component not found');
  }
  return <AccountWishlistPage {...data} customer={layoutData?.customer} />;
}
