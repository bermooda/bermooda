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
import { useT } from '#/core/i18n';
import { loadOrdersAdminIndexData } from '#/core/orders/index.server';
import EmptyState from '#/components/admin/empty-state';
import { controlClasses } from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import { OrderStatusBadge } from '#/components/admin/order-status-badge';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  return loadOrdersAdminIndexData(request, { pageSize: PAGE_SIZE });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminOrdersRoute() {
  const t = useT();
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

  const statusOptions = [
    { value: '', label: t('admin.orders.index.statusAll') },
    { value: 'pending', label: t('admin.orders.status.pending') },
    { value: 'paid', label: t('admin.orders.status.paid') },
    { value: 'fulfilled', label: t('admin.orders.status.fulfilled') },
    { value: 'cancelled', label: t('admin.orders.status.cancelled') },
    { value: 'refunded', label: t('admin.orders.status.refunded') },
  ];

  const columns = [
    { key: 'order', label: t('admin.orders.index.col.order') },
    { key: 'customer', label: t('admin.orders.index.col.customer') },
    { key: 'status', label: t('admin.orders.index.col.status') },
    { key: 'total', label: t('admin.orders.index.col.total'), right: true },
    { key: 'created', label: t('admin.orders.index.col.created') },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.orders.index.title')}
        subtitle={t('admin.orders.index.subtitle')}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label={t('admin.orders.index.stat.total')} value={total} />
        <Stat
          label={t('admin.orders.index.stat.pending')}
          value={pendingCount}
        />
        <Stat label={t('admin.orders.index.stat.paid')} value={paidCount} />
        <Stat
          label={t('admin.orders.index.stat.fulfilled')}
          value={fulfilledCount}
        />
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
                placeholder={t('admin.orders.index.searchPlaceholder')}
                className={`${controlClasses} pl-9`}
              />
            </div>
            <Select
              name="status"
              defaultValue={status === 'all' ? '' : status}
              className="sm:w-44"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Form>
          <ToolbarGroup>
            <span className="text-text-muted text-sm">
              {total === 1
                ? t('admin.orders.index.resultsOne', { count: total })
                : t('admin.orders.index.results', { count: total })}
            </span>
          </ToolbarGroup>
        </Toolbar>

        <Table className="hidden rounded-none border-0 shadow-none md:block">
          <THead>
            <tr>
              {columns.map((col) => (
                <Th
                  key={col.key}
                  className={col.right ? 'text-right' : undefined}
                >
                  {col.label}
                </Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <tr>
                <Td colSpan={5} className="p-0">
                  <EmptyState
                    icon={ShoppingBagIcon}
                    title={t('admin.orders.index.emptyTitle')}
                    description={
                      q || status !== 'all'
                        ? t('admin.orders.index.emptyDescriptionSearch')
                        : t('admin.orders.index.emptyDescription')
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
                  <OrderStatusBadge status={row.status} />
                </Td>
                <Td className="text-text text-right tabular-nums">
                  {formatPrice(row.totalCents, row.currency)}
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
              title={t('admin.orders.index.emptyTitle')}
              description={
                q || status !== 'all'
                  ? t('admin.orders.index.emptyDescriptionSearchShort')
                  : t('admin.orders.index.emptyDescription')
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
                  <OrderStatusBadge status={row.status} />
                </div>
                <p className="text-text mt-2 truncate text-sm">{row.email}</p>
                <div className="text-text-muted mt-3 flex items-center justify-between text-xs">
                  <span className="text-text font-medium">
                    {formatPrice(row.totalCents, row.currency)}
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
