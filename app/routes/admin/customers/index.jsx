// app/routes/admin/customers/index.jsx
// Customers admin list — sticky-header table with search and stats.

import { PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { parseAdminUiPagination } from '#/libs/api/admin-ui/index.server';
import {
  countCustomersWithOrders,
  listCustomers,
} from '#/core/customers/index.server';
import { useT } from '#/core/i18n';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit: pageSize } = parseAdminUiPagination(url.searchParams, {
    limit: PAGE_SIZE,
  });
  const q = url.searchParams.get('q')?.trim() ?? '';

  const [{ customers, total }, withOrdersCount] = await Promise.all([
    listCustomers({ page, limit: pageSize, q, includeOrderCount: true }),
    countCustomersWithOrders(q),
  ]);

  const rows = customers.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    phone: c.phone ?? null,
    orderCount: c._count.orders,
    createdAt: c.createdAt.toISOString(),
  }));

  return {
    rows,
    total,
    withOrdersCount,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    q,
  };
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

/**
 * @param {{ name?: string | null, email: string }} row
 * @returns {string}
 */
function customerLabel(row) {
  return row.name || row.email;
}

export default function AdminCustomersRoute() {
  const t = useT();
  const { rows, total, withOrdersCount, page, totalPages, q } = useLoaderData();
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
        title={t('admin.customers.index.title')}
        subtitle={t('admin.customers.index.subtitle')}
        actions={
          <Link
            to="/admin/customers/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.customers.index.newButton')}
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Stat label={t('admin.customers.index.stat.total')} value={total} />
        <Stat
          label={t('admin.customers.index.stat.withOrders')}
          value={withOrdersCount}
        />
      </div>

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.customers.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.customers.index.resultsOne', { count: total })
              : t('admin.customers.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          icon={UserGroupIcon}
          title={t('admin.customers.index.emptyTitle')}
          description={
            q
              ? t('admin.customers.index.emptyDescriptionSearch')
              : t('admin.customers.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/customers/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.customers.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.customers.index.col.customer')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.customers.index.col.phone')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.customers.index.col.orders')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.customers.index.col.joined')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.customers.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {rows.map((row) => {
              const label = customerLabel(row);
              return (
                <Tr
                  key={row.id}
                  role="link"
                  tabIndex={0}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/admin/customers/${row.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/admin/customers/${row.id}`);
                    }
                  }}
                >
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="group-hover:text-accent block truncate font-medium transition-colors">
                        {label}
                      </span>
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {row.name ? row.email : row.id.slice(0, 8)}
                      </span>
                    </span>
                  </Td>
                  <Td
                    sticky
                    className="text-text hidden px-3 py-4 sm:table-cell"
                  >
                    {row.phone ?? '—'}
                  </Td>
                  <Td sticky className="px-3 py-4 tabular-nums">
                    {row.orderCount}
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
                      to={`/admin/customers/${row.id}`}
                      className="text-accent hover:text-accent-hover"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('admin.customers.index.edit')}
                      <span className="sr-only">, {label}</span>
                    </Link>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
