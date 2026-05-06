import {
  ArchiveBoxXMarkIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';

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
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    totalOrders,
    revenueAgg,
    abandonedCheckouts,
    lowStockCount,
    recentOrders,
  ] = await Promise.all([
    // Total orders count
    prisma.order.count(),

    // Sum of all order totals
    prisma.order.aggregate({
      _sum: { totalCents: true },
    }),

    // Abandoned checkouts: older than 1 hour and step != 'complete'
    prisma.checkoutSession.count({
      where: {
        step: { not: 'complete' },
        createdAt: { lt: oneHourAgo },
      },
    }),

    // Low-stock variants: inventoryTracked=true and inventoryCount < 5
    prisma.productVariant.count({
      where: {
        inventoryTracked: true,
        inventoryCount: { lt: 5 },
      },
    }),

    // Last 10 orders
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        customer: {
          select: { email: true },
        },
      },
    }),
  ]);

  const totalRevenueCents = revenueAgg._sum.totalCents ?? 0;

  return {
    totalOrders,
    totalRevenueCents,
    abandonedCheckouts,
    lowStockCount,
    recentOrders: recentOrders.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------------
// Slot — renders plugin blocks for the named slot.
// Inline definition to avoid importing from app/core/index.js which
// re-exports server-only modules and would break the client bundle.
// ---------------------------------------------------------------------------

/**
 * Renders children (plugin blocks) for the named slot, if any.
 * Currently a no-op stub; real plugin wiring arrives in a later phase.
 *
 * @param {{ name: string, children?: React.ReactNode }} props
 */
function Slot({ children }) {
  return children ?? null;
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

const STATUS_STYLES = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  fulfilled:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
};

/**
 * Pill badge for order status.
 *
 * @param {{ status: string }} props
 */
function StatusBadge({ status }) {
  const styles =
    STATUS_STYLES[status] ??
    'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
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
    <div className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="dark:bg-dark-700 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </div>
        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {label}
        </dt>
      </div>
      <dd className="mt-4 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {value}
      </dd>
    </div>
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
  } = useLoaderData();

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of your store&apos;s performance.
        </p>
      </div>

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
      <Slot name="dashboard.widgets" />

      {/* Recent orders */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Recent Orders
        </h2>

        {recentOrders.length === 0 ? (
          <div className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No orders yet.
            </p>
          </div>
        ) : (
          <div className="dark:border-dark-700 dark:bg-dark-800 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="dark:divide-dark-700 min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {['Order', 'Customer', 'Status', 'Total', 'Date'].map(
                      (col) => (
                        <th
                          key={col}
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="dark:divide-dark-700/60 divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="dark:hover:bg-dark-700/30 hover:bg-gray-50"
                    >
                      {/* Order number */}
                      <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white">
                        #{order.orderNumber}
                      </td>

                      {/* Customer email */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-600 dark:text-gray-300">
                        {order.customer?.email ?? order.email}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        <StatusBadge status={order.status} />
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900 dark:text-white">
                        {formatCents(order.totalCents, order.currency)}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
