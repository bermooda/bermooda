// app/routes/admin/dashboard.jsx
import {
  ArchiveBoxXMarkIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { useLoaderData } from 'react-router';

import { getAdminSlotBlocksMap } from '#/core/admin/slots/index.server';
import { formatPrice } from '#/core/currency/format';
import { useT } from '#/core/i18n';
import { loadAdminDashboardData } from '#/core/reporting/index.server';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import { OrderStatusBadge } from '#/components/admin/order-status-badge';
import PageHeader from '#/components/admin/page-header';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';
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
  const [dashboard, slotBlocks] = await Promise.all([
    loadAdminDashboardData(),
    getAdminSlotBlocksMap(['dashboard.widgets']),
  ]);

  return {
    ...dashboard,
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
  return new Date(iso).toLocaleDateString('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Single KPI metric tile.
 *
 * @param {{ icon: React.ElementType, label: string, value: string|number }} props
 */
function KpiTile({ icon: Icon, label, value }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="bg-surface-2 text-text-muted flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
          <Icon className="h-5 w-5" />
        </div>
        <dt className="text-text-muted text-sm font-medium">{label}</dt>
      </div>
      <dd className="text-text mt-4 text-3xl font-semibold tracking-tight">
        {value}
      </dd>
    </Card>
  );
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
  const t = useT();
  const {
    totalOrders,
    totalRevenueCents,
    abandonedCheckouts,
    lowStockCount,
    recentOrders,
    slotBlocks,
  } = useLoaderData();

  const columns = [
    t('admin.dashboard.col.order'),
    t('admin.dashboard.col.customer'),
    t('admin.dashboard.col.status'),
    t('admin.dashboard.col.total'),
    t('admin.dashboard.col.date'),
  ];

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <PageHeader
        title={t('admin.dashboard.title')}
        subtitle={t('admin.dashboard.subtitle')}
      />

      {/* KPI tiles */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={ShoppingBagIcon}
          label={t('admin.dashboard.stat.totalOrders')}
          value={totalOrders.toLocaleString('en')}
        />
        <KpiTile
          icon={BanknotesIcon}
          label={t('admin.dashboard.stat.totalRevenue')}
          value={formatPrice(totalRevenueCents)}
        />
        <KpiTile
          icon={ArchiveBoxXMarkIcon}
          label={t('admin.dashboard.stat.abandonedCheckouts')}
          value={abandonedCheckouts.toLocaleString('en')}
        />
        <KpiTile
          icon={ExclamationTriangleIcon}
          label={t('admin.dashboard.stat.lowStockItems')}
          value={lowStockCount.toLocaleString('en')}
        />
      </dl>

      {/* Plugin slot */}
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

      {/* Recent orders */}
      <div>
        <h2 className="text-text mb-4 text-lg font-semibold">
          {t('admin.dashboard.recentOrders')}
        </h2>

        {recentOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBagIcon}
            title={t('admin.dashboard.emptyTitle')}
            description={t('admin.dashboard.emptyDescription')}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                {columns.map((col) => (
                  <Th key={col}>{col}</Th>
                ))}
              </tr>
            </THead>
            <TBody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <Td className="text-text font-medium">
                    #{order.orderNumber}
                  </Td>
                  <Td>{order.customer?.email ?? order.email}</Td>
                  <Td>
                    <OrderStatusBadge status={order.status} />
                  </Td>
                  <Td className="text-text">
                    {formatPrice(order.totalCents, order.currency)}
                  </Td>
                  <Td>{formatDate(order.createdAt)}</Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
