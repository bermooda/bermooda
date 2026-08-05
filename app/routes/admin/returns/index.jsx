// app/routes/admin/returns/index.jsx
// Returns admin list — sticky-header table with status filters.

import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { useT } from '#/core/i18n';
import {
  listReturns,
  parseReturnListParams,
  RETURN_STATUSES,
} from '#/core/returns/index.server';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import { ReturnStatusBadge } from '#/components/admin/return-status-badge';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReturnListParams(url.searchParams);
  const result = await listReturns({ ...params, limit: PAGE_SIZE });

  return {
    ...result,
    status: params.status ?? '',
    totalPages: Math.ceil(result.total / PAGE_SIZE),
    returnStatuses: RETURN_STATUSES,
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
 * @param {string} status
 * @param {(key: string) => string} t
 * @returns {string}
 */
function returnStatusLabel(status, t) {
  const key = `admin.returns.status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

/**
 * @param {string | null | undefined} resolution
 * @param {(key: string) => string} t
 * @returns {string}
 */
function resolutionLabel(resolution, t) {
  if (!resolution) return '—';
  const key = `admin.returns.resolution.${resolution}`;
  const label = t(key);
  return label === key ? resolution : label;
}

export default function AdminReturnsRoute() {
  const t = useT();
  const { returns, total, page, totalPages, status, returnStatuses } =
    useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * @param {string} next
   */
  function setStatus(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (!next) params.delete('status');
      else params.set('status', next);
      params.delete('page');
      return params;
    });
  }

  /**
   * @param {number} p
   */
  function goToPage(p) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(p));
      return params;
    });
  }

  const statusFilters = [
    { key: '', label: t('admin.returns.index.tabAll') },
    ...returnStatuses.map((value) => ({
      key: value,
      label: returnStatusLabel(value, t),
    })),
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.returns.index.title')}
        subtitle={t('admin.returns.index.subtitle')}
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map((s) => (
              <button
                key={s.key || 'all'}
                type="button"
                onClick={() => setStatus(s.key)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  status === s.key
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text-muted hover:text-text'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </ToolbarGroup>
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.returns.index.resultsOne', { count: total })
              : t('admin.returns.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {returns.length === 0 ? (
        <EmptyState
          icon={ArrowUturnLeftIcon}
          title={t('admin.returns.index.emptyTitle')}
          description={
            status
              ? t('admin.returns.index.emptyDescriptionStatus', {
                  status: returnStatusLabel(status, t),
                })
              : t('admin.returns.index.emptyDescription')
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.returns.index.col.order')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.returns.index.col.status')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.returns.index.col.customer')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.returns.index.col.resolution')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 lg:table-cell">
                {t('admin.returns.index.col.items')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.returns.index.col.date')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.returns.index.col.view')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {returns.map((ret) => {
              const orderLabel =
                ret.order?.orderNumber ?? ret.orderId.slice(-8);
              return (
                <Tr
                  key={ret.id}
                  role="link"
                  tabIndex={0}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/admin/orders/${ret.orderId}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/admin/orders/${ret.orderId}`);
                    }
                  }}
                >
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="group-hover:text-accent block truncate font-medium transition-colors">
                        {orderLabel}
                      </span>
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {ret.id.slice(0, 8)}
                      </span>
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <ReturnStatusBadge status={ret.status} />
                  </Td>
                  <Td
                    sticky
                    className="text-text-muted hidden px-3 py-4 sm:table-cell"
                  >
                    {ret.order?.email ?? '—'}
                  </Td>
                  <Td sticky className="hidden px-3 py-4 md:table-cell">
                    {resolutionLabel(ret.resolution, t)}
                  </Td>
                  <Td
                    sticky
                    className="text-text-muted hidden max-w-xs truncate px-3 py-4 whitespace-normal lg:table-cell"
                  >
                    {ret.lines
                      .map(
                        (line) =>
                          line.title ?? t('admin.returns.index.itemFallback')
                      )
                      .join(', ')}
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {formatDate(ret.createdAt)}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <Link
                      to={`/admin/orders/${ret.orderId}`}
                      className="text-accent hover:text-accent-hover"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('admin.returns.index.view')}
                      <span className="sr-only">, {orderLabel}</span>
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
