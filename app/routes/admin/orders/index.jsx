// app/routes/admin/orders/index.jsx
// Orders admin list — paginated table with status filter and search.

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import { controlClasses } from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';
import { ButtonSubmit } from '#/components/ui/button';

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
    where.OR = [{ orderNumber: { contains: q } }, { email: { contains: q } }];
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

const STATUS_TONES = {
  pending: 'warn',
  pending_payment: 'warn',
  paid: 'accent',
  fulfilled: 'success',
  cancelled: 'danger',
  refunded: 'neutral',
};

function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>;
}

function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
      <PageHeader
        title="Orders"
        subtitle={`${total} order${total !== 1 ? 's' : ''}`}
        className="mb-6"
      />

      {/* Filters */}
      <Form method="get" className="mb-4 flex flex-col gap-3 sm:flex-row">
        {/* Search */}
        <div className="relative sm:max-w-sm sm:flex-1">
          <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Order # or email…"
            className={`${controlClasses} pl-9`}
          />
        </div>

        {/* Status filter */}
        <Select name="status" defaultValue={status} className="sm:w-44">
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <ButtonSubmit>Filter</ButtonSubmit>
      </Form>

      {/* Table (md+) */}
      <Table className="hidden md:block">
        <THead>
          <tr>
            <Th>Order #</Th>
            <Th>Customer</Th>
            <Th>Status</Th>
            <Th className="text-right">Total</Th>
            <Th>Created</Th>
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                No orders found.
              </Td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <Link
                  to={`/admin/orders/${row.id}`}
                  className="text-accent font-mono text-sm font-medium hover:underline"
                >
                  {row.orderNumber}
                </Link>
              </Td>
              <Td className="text-text">{row.email}</Td>
              <Td>
                <StatusBadge status={row.status} />
              </Td>
              <Td className="text-text text-right">
                {formatCents(row.totalCents, row.currency)}
              </Td>
              <Td>{formatDate(row.createdAt)}</Td>
            </tr>
          ))}
        </TBody>
      </Table>

      {/* Card list (mobile) */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <Card className="text-text-muted text-center text-sm">
            No orders found.
          </Card>
        ) : (
          rows.map((row) => (
            <Link key={row.id} to={`/admin/orders/${row.id}`} className="block">
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-accent font-mono text-sm font-medium">
                    {row.orderNumber}
                  </span>
                  <StatusBadge status={row.status} />
                </div>
                <p className="text-text truncate text-sm">{row.email}</p>
                <div className="text-text-muted flex items-center justify-between text-xs">
                  <span className="text-text font-medium">
                    {formatCents(row.totalCents, row.currency)}
                  </span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
