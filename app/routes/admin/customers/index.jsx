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

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

  const columns = [
    t('admin.customers.index.col.customer'),
    t('admin.customers.index.col.phone'),
    t('admin.customers.index.col.orders'),
    t('admin.customers.index.col.joined'),
  ];

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

      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-xs">
        <Toolbar>
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

        <Table className="hidden rounded-none border-0 shadow-none md:block">
          <THead>
            <tr>
              {columns.map((col) => (
                <Th key={col}>{col}</Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <tr>
                <Td colSpan={4} className="p-0">
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
                onClick={() => navigate(`/admin/customers/${row.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/customers/${row.id}`);
                  }
                }}
              >
                <Td className="whitespace-normal">
                  <span className="block min-w-0">
                    <span className="text-text group-hover:text-accent block truncate font-medium transition-colors">
                      {row.name || row.email}
                    </span>
                    {row.name && (
                      <span className="text-text-muted mt-0.5 block truncate text-xs">
                        {row.email}
                      </span>
                    )}
                  </span>
                </Td>
                <Td className="text-text">{row.phone ?? '—'}</Td>
                <Td className="tabular-nums">{row.orderCount}</Td>
                <Td className="tabular-nums">{formatDate(row.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>

        <div className="divide-border divide-y md:hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon={UserGroupIcon}
              title={t('admin.customers.index.emptyTitle')}
              description={
                q
                  ? t('admin.customers.index.emptyDescriptionSearchShort')
                  : t('admin.customers.index.emptyDescription')
              }
              className="border-0 shadow-none"
            />
          ) : (
            rows.map((row) => (
              <Link
                key={row.id}
                to={`/admin/customers/${row.id}`}
                className="hover:bg-surface-2/60 block px-4 py-4 transition-colors"
              >
                <p className="text-text truncate text-sm font-medium">
                  {row.name || row.email}
                </p>
                {row.name && (
                  <p className="text-text-muted mt-0.5 truncate text-xs">
                    {row.email}
                  </p>
                )}
                <div className="text-text-muted mt-3 flex items-center justify-between text-xs">
                  <span>
                    {row.orderCount === 1
                      ? t('admin.customers.index.ordersCountOne', {
                          count: row.orderCount,
                        })
                      : t('admin.customers.index.ordersCount', {
                          count: row.orderCount,
                        })}
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
