import { Link } from 'react-router';

import { useT } from '#/core/i18n/index';
import { formatPrice } from '#/core/index';

function StatusBadge({ status }) {
  const colours = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-zinc-100 text-zinc-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colours[status] ?? 'bg-zinc-100 text-zinc-800'}`}
    >
      {status}
    </span>
  );
}

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
            Browse Products
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
                    <StatusBadge status={order.status} />
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

      {/* Pagination placeholder */}
      {total > 20 && (
        <div className="text-center text-sm text-zinc-500">
          Showing page {page} — pagination coming soon
        </div>
      )}
    </div>
  );
}
