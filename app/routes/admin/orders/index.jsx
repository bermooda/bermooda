// app/routes/admin/orders/index.jsx
// Orders admin list — sticky-header table with status filter and search.

import { ShoppingBagIcon } from '@heroicons/react/24/outline';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { formatPrice } from '#/core/currency/format';
import { useT } from '#/core/i18n';
import { loadOrdersAdminIndexData } from '#/core/orders/index.server';
import EmptyState from '#/components/admin/empty-state';
import Select from '#/components/admin/form/select';
import { OrderStatusBadge } from '#/components/admin/order-status-badge';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  return loadOrdersAdminIndexData(request, { pageSize: PAGE_SIZE });
}

/**
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

  /**
   * @param {string} nextStatus
   */
  function setStatus(nextStatus) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!nextStatus) next.delete('status');
      else next.set('status', nextStatus);
      next.delete('page');
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

  const hasFilter = Boolean(q) || status !== 'all';

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

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center">
          <SearchField
            defaultValue={q}
            placeholder={t('admin.orders.index.searchPlaceholder')}
            formClassName="w-full flex-1"
            hiddenFields={status !== 'all' ? { status } : {}}
          />
          <Select
            name="status"
            value={status === 'all' ? '' : status}
            onChange={(event) => setStatus(event.target.value)}
            className="sm:w-44"
            aria-label={t('admin.orders.index.col.status')}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.orders.index.resultsOne', { count: total })
              : t('admin.orders.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingBagIcon}
          title={t('admin.orders.index.emptyTitle')}
          description={
            hasFilter
              ? t('admin.orders.index.emptyDescriptionSearch')
              : t('admin.orders.index.emptyDescription')
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.orders.index.col.order')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.orders.index.col.customer')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.orders.index.col.status')}
              </Th>
              <Th sticky className="px-3 py-3.5 text-right">
                {t('admin.orders.index.col.total')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.orders.index.col.created')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.orders.index.col.view')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
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
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="group-hover:text-accent block truncate font-mono font-medium transition-colors">
                      {row.orderNumber}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate text-xs font-normal sm:hidden">
                      {row.email}
                    </span>
                  </span>
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 whitespace-normal sm:table-cell"
                >
                  <span className="block truncate">{row.email}</span>
                </Td>
                <Td sticky className="px-3 py-4">
                  <OrderStatusBadge status={row.status} />
                </Td>
                <Td sticky className="px-3 py-4 text-right tabular-nums">
                  {formatPrice(row.totalCents, row.currency)}
                </Td>
                <Td
                  sticky
                  className="hidden px-3 py-4 tabular-nums md:table-cell"
                >
                  {formatDate(row.createdAt)}
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <Link
                    to={`/admin/orders/${row.id}`}
                    className="text-accent hover:text-accent-hover"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('admin.orders.index.view')}
                    <span className="sr-only">, {row.orderNumber}</span>
                  </Link>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
