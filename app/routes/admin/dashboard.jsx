// app/routes/admin/dashboard.jsx
import {
  ArchiveBoxXMarkIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { Link, useLoaderData, useNavigate } from 'react-router';

import { getAdminSlotBlocksMap } from '#/core/admin/slots/index.server';
import { useT } from '#/core/i18n';
import { loadAdminDashboardData } from '#/core/reporting/index.server';
import {
  DEFAULT_CURRENCY,
  SETTING_KEYS,
  get as getSetting,
} from '#/core/settings/index.server';
import useFormatPrice from '#/hooks/use-format-price';
import EmptyState from '#/components/admin/empty-state';
import { OrderStatusBadge } from '#/components/admin/order-status-badge';
import PageHeader from '#/components/admin/page-header';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import SlotBlocks from '#/components/slot-blocks';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function meta() {
  return [
    { title: 'Admin Dashboard' },
    { name: 'description', content: 'Admin dashboard overview' },
  ];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Fetches all KPI data and recent orders for the dashboard.
 * Auth is handled by the parent layout loader — this loader assumes the user
 * is already authenticated.
 */
export async function loader() {
  const [dashboard, slotBlocks, shopCurrency] = await Promise.all([
    loadAdminDashboardData(),
    getAdminSlotBlocksMap(['dashboard.widgets']),
    getSetting(SETTING_KEYS.DEFAULT_CURRENCY),
  ]);

  return {
    ...dashboard,
    shopCurrency: shopCurrency ?? DEFAULT_CURRENCY,
    slotBlocks,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string as a short localised date.
 *
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

/**
 * Admin Dashboard Route
 * Displays KPI tiles, recent orders, and any plugin blocks in the
 * `dashboard.widgets` slot.
 *
 * @returns {React.ReactElement}
 */
export default function AdminDashboardRoute() {
  const formatPrice = useFormatPrice();
  const t = useT();
  const navigate = useNavigate();
  const {
    totalOrders,
    totalRevenueCents,
    shopCurrency,
    abandonedCheckouts,
    lowStockCount,
    recentOrders,
    slotBlocks,
  } = useLoaderData();

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('admin.dashboard.title')}
        subtitle={t('admin.dashboard.subtitle')}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={ShoppingBagIcon}
          label={t('admin.dashboard.stat.totalOrders')}
          value={totalOrders.toLocaleString('en')}
        />
        <Stat
          icon={BanknotesIcon}
          label={t('admin.dashboard.stat.totalRevenue')}
          value={formatPrice(totalRevenueCents, shopCurrency)}
        />
        <Stat
          icon={ArchiveBoxXMarkIcon}
          label={t('admin.dashboard.stat.abandonedCheckouts')}
          value={abandonedCheckouts.toLocaleString('en')}
        />
        <Stat
          icon={ExclamationTriangleIcon}
          label={t('admin.dashboard.stat.lowStockItems')}
          value={lowStockCount.toLocaleString('en')}
        />
      </div>

      <SlotBlocks
        blocks={slotBlocks['dashboard.widgets'] ?? []}
        slotProps={{
          totalOrders,
          totalRevenueCents,
          abandonedCheckouts,
          lowStockCount,
          recentOrders,
        }}
      />

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-text text-base font-semibold">
            {t('admin.dashboard.recentOrders')}
          </h2>
          {recentOrders.length > 0 && (
            <Link
              to="/admin/orders"
              className="text-accent hover:text-accent-hover text-sm font-medium"
            >
              {t('admin.dashboard.viewAllOrders')}
            </Link>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBagIcon}
            title={t('admin.dashboard.emptyTitle')}
            description={t('admin.dashboard.emptyDescription')}
          />
        ) : (
          <Table variant="sticky" className="mt-2">
            <THead sticky>
              <tr>
                <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                  {t('admin.dashboard.col.order')}
                </Th>
                <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                  {t('admin.dashboard.col.customer')}
                </Th>
                <Th sticky className="px-3 py-3.5">
                  {t('admin.dashboard.col.status')}
                </Th>
                <Th sticky className="px-3 py-3.5 text-right">
                  {t('admin.dashboard.col.total')}
                </Th>
                <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                  {t('admin.dashboard.col.date')}
                </Th>
                <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                  <span className="sr-only">
                    {t('admin.dashboard.col.view')}
                  </span>
                </Th>
              </tr>
            </THead>
            <TBody sticky>
              {recentOrders.map((order) => {
                const customerLabel = order.customer?.email ?? order.email;
                return (
                  <Tr
                    key={order.id}
                    role="link"
                    tabIndex={0}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/admin/orders/${order.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/admin/orders/${order.id}`);
                      }
                    }}
                  >
                    <Td
                      sticky
                      className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                    >
                      <span className="block min-w-0">
                        <span className="group-hover:text-accent block truncate font-mono font-medium transition-colors">
                          {order.orderNumber}
                        </span>
                        <span className="text-text-muted mt-0.5 block truncate text-xs font-normal sm:hidden">
                          {customerLabel}
                        </span>
                      </span>
                    </Td>
                    <Td
                      sticky
                      className="hidden px-3 py-4 whitespace-normal sm:table-cell"
                    >
                      <span className="block truncate">{customerLabel}</span>
                    </Td>
                    <Td sticky className="px-3 py-4">
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td sticky className="px-3 py-4 text-right tabular-nums">
                      {formatPrice(order.totalCents, order.currency)}
                    </Td>
                    <Td
                      sticky
                      className="hidden px-3 py-4 tabular-nums md:table-cell"
                    >
                      {formatDate(order.createdAt)}
                    </Td>
                    <Td
                      sticky
                      className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                    >
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="text-accent hover:text-accent-hover"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {t('admin.dashboard.view')}
                        <span className="sr-only">, {order.orderNumber}</span>
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
