import { Link } from 'react-router';

import { useT } from '#/core/i18n';
import SlotBlocks from '#/components/slot-blocks';

import { formatPrice } from '#/core';
import AccountStatusBadge from './account-status-badge';

export default function AccountDashboard({
  recentOrders = [],
  locale,
  customer,
  slotBlocks = {},
}) {
  const t = useT();
  const dashboardSlotBlocks = slotBlocks['account.dashboard'] ?? [];
  const slotProps = { recentOrders, locale, customer };

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Welcome back{customer?.name ? `, ${customer.name}` : ''}!
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{customer?.email}</p>
      </div>

      <SlotBlocks blocks={dashboardSlotBlocks} slotProps={slotProps} />

      {/* Recent orders */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('account.recentOrders')}
          </h2>
          <Link
            to="/account/orders"
            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            View all →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
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
                  {['Order', 'Date', 'Status', 'Total'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-700 dark:bg-zinc-900">
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link
                        to={`/account/orders/${order.id}`}
                        className="text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        #{order.orderNumber}
                      </Link>
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
                        order.currency ?? 'USD',
                        locale
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
