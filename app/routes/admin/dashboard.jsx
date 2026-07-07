// app/routes/admin/dashboard.jsx
import {
  ArchiveBoxXMarkIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { useLoaderData } from 'react-router';

import { getAdminSlotBlocksMap } from '#/core/admin/slots.server';
import { loadAdminDashboardData } from '#/core/reporting/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
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
 * Format cents as a localised currency string using Intl.NumberFormat.
 *
 * @param {number} cents
 * @param {string} [currency='USD']
 * @returns {string}
 */
function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

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

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_TONES = {
  pending: 'warn',
  paid: 'accent',
  fulfilled: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
};

/**
 * Pill badge for order status.
 *
 * @param {{ status: string }} props
 */
function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>;
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------

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
  const {
    totalOrders,
    totalRevenueCents,
    abandonedCheckouts,
    lowStockCount,
    recentOrders,
    slotBlocks,
  } = useLoaderData();

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your store's performance."
      />

      {/* KPI tiles */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={ShoppingBagIcon}
          label="Total Orders"
          value={totalOrders.toLocaleString('en')}
        />
        <KpiTile
          icon={BanknotesIcon}
          label="Total Revenue"
          value={formatCents(totalRevenueCents)}
        />
        <KpiTile
          icon={ArchiveBoxXMarkIcon}
          label="Abandoned Checkouts"
          value={abandonedCheckouts.toLocaleString('en')}
        />
        <KpiTile
          icon={ExclamationTriangleIcon}
          label="Low-Stock Items"
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
        <h2 className="text-text mb-4 text-lg font-semibold">Recent Orders</h2>

        {recentOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBagIcon}
            title="No orders yet"
            description="Orders will appear here once customers start checking out."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                {['Order', 'Customer', 'Status', 'Total', 'Date'].map((col) => (
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
                    <StatusBadge status={order.status} />
                  </Td>
                  <Td className="text-text">
                    {formatCents(order.totalCents, order.currency)}
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
