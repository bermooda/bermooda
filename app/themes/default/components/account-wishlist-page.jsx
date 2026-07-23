import { Form, Link } from 'react-router';

import { useT } from '#/core/i18n';

export default function AccountWishlistPage({ itemsData, actionData }) {
  const t = useT();
  const items = itemsData?.items ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {t('account.wishlist')}
      </h1>

      {actionData?.error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionData.error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-600">
          <p className="text-sm text-zinc-500">{t('account.noWishlist')}</p>
          <Link
            to="/search"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            {t('account.browseProducts')}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
          {items.map((item) => {
            const href = item.productSlug
              ? `/products/${item.productSlug}`
              : null;

            return (
              <li key={item.id} className="flex items-center gap-4 px-4 py-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link
                      to={href}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {item.productTitle ?? item.variantSku ?? item.variantId}
                    </Link>
                  ) : (
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {item.productTitle ?? item.variantSku ?? item.variantId}
                    </p>
                  )}
                  {item.variantSku ? (
                    <p className="text-sm text-zinc-500">{item.variantSku}</p>
                  ) : null}
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="remove" />
                  <input
                    type="hidden"
                    name="variantId"
                    value={item.variantId}
                  />
                  <button
                    type="submit"
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    {t('account.removeFromWishlist')}
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
