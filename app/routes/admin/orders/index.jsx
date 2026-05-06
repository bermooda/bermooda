// app/routes/admin/orders/index.jsx
// Orders admin list — paginated table with status filter and search.

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData, useSearchParams } from 'react-router';
import clsx from 'clsx';

import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const q = url.searchParams.get('q')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() ?? '';

  const where = {};

  if (status && status !== 'all') {
    where.status = status;
  }

  if (q) {
    where.OR = [
      { orderNumber: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        email: true,
        status: true,
        currency: true,
        totalCents: true,
        createdAt: true,
      },
    }),
  ]);

  const rows = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    email: o.email,
    status: o.status,
    currency: o.currency,
    totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(),
  }));

  return {
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    q,
    status,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CLASSES = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fulfilled:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded:
    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function StatusBadge({ status }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        STATUS_CLASSES[status] ??
          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
      )}
    >
      {status}
    </span>
  );
}

function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminOrdersRoute() {
  const { rows, total, page, totalPages, q, status } = useLoaderData();
  const [, setSearchParams] = useSearchParams();

  function goToPage(p) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Orders
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {total} order{total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <Form method="get" className="mb-4 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Order # or email…"
            className="w-full rounded-md border-0 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
          />
        </div>

        {/* Status filter */}
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border-0 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Filter
        </button>
      </Form>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                Order #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500"
                >
                  No orders found.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/60"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/orders/${row.id}`}
                    className="font-mono text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {row.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                  {row.email}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-zinc-300">
                  {formatCents(row.totalCents, row.currency)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400">
                  {new Date(row.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-zinc-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
