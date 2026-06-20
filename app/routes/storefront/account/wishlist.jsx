// app/routes/storefront/account/wishlist.jsx

import { Form, Link, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';
import {
  addToWishlist,
  listWishlistItems,
  removeFromWishlist,
} from '#/core/wishlists/index.server';

export async function loader({ request }) {
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  const items = customer ? await listWishlistItems(customer.id) : [];
  return { items };
}

export async function action({ request }) {
  const session = await getCustomerSession(request);
  const customer = session?.user ?? null;
  if (!customer) return { ok: false, error: 'Not authenticated' };

  const formData = await request.formData();
  const intent = formData.get('intent');
  const variantId = formData.get('variantId')?.toString();

  if (!variantId) {
    return { ok: false, error: 'Missing variant.' };
  }

  if (intent === 'add') {
    await addToWishlist(customer.id, variantId);
    return { ok: true };
  }

  if (intent === 'remove') {
    await removeFromWishlist(customer.id, variantId);
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action.' };
}

export const meta = () => [{ title: 'Wishlist' }];

function formatMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(
    cents / 100
  );
}

export default function AccountWishlistRoute() {
  const { items } = useLoaderData();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Wishlist</h1>

      {items.length === 0 ? (
        <p className="mt-4 text-slate-600">
          Your wishlist is empty.{' '}
          <Link to="/search" className="text-indigo-600 hover:underline">
            Browse products
          </Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200">
          {items.map((item) => {
            const price = item.variant.prices[0];
            return (
              <li key={item.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {item.variant.sku || item.variant.id}
                  </p>
                  {price ? (
                    <p className="text-sm text-slate-500">
                      {formatMoney(price.priceCents, price.currency)}
                    </p>
                  ) : null}
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="variantId" value={item.variantId} />
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </Form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
