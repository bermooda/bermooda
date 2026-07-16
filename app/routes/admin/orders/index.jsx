// app/routes/admin/orders/index.jsx
// Orders admin list — paginated table with status filter and search.

import {
  MagnifyingGlassIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { formatPrice } from '#/core/currency/format';
import { loadOrdersAdminIndexData } from '#/core/orders/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import { controlClasses } from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  return loadOrdersAdminIndexData(request, { pageSize: PAGE_SIZE });
}

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
  return formatPrice(cents, currency);
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

export default function AdminOrdersRoute() {
  const {
    rows,
    total,
    pendingCount,
    paidCount,
    fulfilledCount,
    page,
    totalPages,
    q,
    status,
  } = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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
        subtitle="View and manage customer orders, shipments, and refunds."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Total orders" value={total} />
        <Stat label="Pending" value={pendingCount} />
        <Stat label="Paid" value={paidCount} />
        <Stat label="Fulfilled" value={fulfilledCount} />
      </div>

      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-xs">
        <Toolbar>
          <Form
            method="get"
            className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row"
          >
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Order # or email…"
                className={`${controlClasses} pl-9`}
              />
            </div>
            <Select
              name="status"
              defaultValue={status === 'all' ? '' : status}
              className="sm:w-44"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Form>
          <ToolbarGroup>
            <span className="text-text-muted text-sm">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </ToolbarGroup>
        </Toolbar>

        <Table className="hidden rounded-none border-0 shadow-none md:block">
          <THead>
            <tr>
              {['Order', 'Customer', 'Status', 'Total', 'Created'].map(
                (col) => (
                  <Th
                    key={col}
                    className={col === 'Total' ? 'text-right' : undefined}
                  >
                    {col}
                  </Th>
                )
              )}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <tr>
                <Td colSpan={5} className="p-0">
                  <EmptyState
                    icon={ShoppingBagIcon}
                    title="No orders found"
                    description={
                      q || status !== 'all'
                        ? 'Try a different search term or clear the filter.'
                        : 'Orders will appear here once customers check out.'
                    }
                    className="border-0 shadow-none"
                  />
                </Td>
              </tr>
            )}
            {rows.map((row) => (
              <Tr
                key={row.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/orders/${row.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/orders/${row.id}`);
                  }
                }}
              >
                <Td>
                  <span className="text-text group-hover:text-accent font-mono text-sm font-medium transition-colors">
                    {row.orderNumber}
                  </span>
                </Td>
                <Td className="text-text whitespace-normal">
                  <span className="block truncate">{row.email}</span>
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                <Td className="text-text text-right tabular-nums">
                  {formatCents(row.totalCents, row.currency)}
                </Td>
                <Td className="tabular-nums">{formatDate(row.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>

        <div className="divide-border divide-y md:hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon={ShoppingBagIcon}
              title="No orders found"
              description={
                q || status !== 'all'
                  ? 'Try a different search term.'
                  : 'Orders will appear here once customers check out.'
              }
              className="border-0 shadow-none"
            />
          ) : (
            rows.map((row) => (
              <Link
                key={row.id}
                to={`/admin/orders/${row.id}`}
                className="hover:bg-surface-2/60 block px-4 py-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-accent font-mono text-sm font-medium">
                    {row.orderNumber}
                  </span>
                  <StatusBadge status={row.status} />
                </div>
                <p className="text-text mt-2 truncate text-sm">{row.email}</p>
                <div className="text-text-muted mt-3 flex items-center justify-between text-xs">
                  <span className="text-text font-medium">
                    {formatCents(row.totalCents, row.currency)}
                  </span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
