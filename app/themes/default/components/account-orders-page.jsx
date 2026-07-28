import { Link } from 'react-router';

import { useT } from '#/core/i18n';

import { formatPrice } from '#/core';
import AccountStatusBadge from './account-status-badge';
import CatalogPagination from './catalog-pagination';

const ORDERS_PAGE_SIZE = 20;

export default function AccountOrdersPage({
  ordersData,
  page = 1,
  locale,
  currency,
}) {
  const t = useT();
  const orders = ordersData?.orders ?? [];
  const total = ordersData?.total ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {t('account.orders')}
      </h1>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-600">
          <p className="text-sm text-zinc-500">{t('account.noOrders')}</p>
          <Link
            to="/"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
          >
            {t('account.browseProducts')}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                {['Order', 'Date', 'Status', 'Total', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    #{order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString(
                          locale ?? 'en'
                        )
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <AccountStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatPrice(
                      order.totalCents,
                      order.currency ?? currency ?? 'USD',
                      locale
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      to={`/account/orders/${order.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CatalogPagination
        page={page}
        total={total}
        pathname="/account/orders"
        pageSize={ORDERS_PAGE_SIZE}
      />
    </div>
  );
}
