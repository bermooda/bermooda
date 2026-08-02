// app/routes/admin/returns/index.jsx

import clsx from 'clsx';
import { Link, useLoaderData, useSearchParams } from 'react-router';

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
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReturnListParams(url.searchParams);
  const result = await listReturns({ ...params, limit: PAGE_SIZE });

  return {
    ...result,
    status: params.status ?? '',
    returnStatuses: RETURN_STATUSES,
  };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminReturnsRoute() {
  const t = useT();
  const { returns, total, page, status, returnStatuses } = useLoaderData();
  const [searchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title={t('admin.returns.index.title')}
        subtitle={t('admin.returns.index.subtitle')}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to="/admin/returns"
          className={clsx(
            'rounded-full px-3 py-1 text-sm font-medium transition',
            !status
              ? 'bg-accent text-accent-fg'
              : 'bg-surface-2 text-text-muted hover:text-text'
          )}
        >
          {t('admin.returns.index.tabAll')}
        </Link>
        {returnStatuses.map((value) => {
          const labelKey = `admin.returns.status.${value}`;
          const label = t(labelKey);
          return (
            <Link
              key={value}
              to={`/admin/returns?status=${value}`}
              className={clsx(
                'rounded-full px-3 py-1 text-sm font-medium transition',
                status === value
                  ? 'bg-accent text-accent-fg'
                  : 'bg-surface-2 text-text-muted hover:text-text'
              )}
            >
              {label === labelKey ? value : label}
            </Link>
          );
        })}
      </div>

      {returns.length === 0 ? (
        <EmptyState
          title={t('admin.returns.index.emptyTitle')}
          description={
            status
              ? t('admin.returns.index.emptyDescriptionStatus', {
                  status: (() => {
                    const key = `admin.returns.status.${status}`;
                    const label = t(key);
                    return label === key ? status : label;
                  })(),
                })
              : t('admin.returns.index.emptyDescription')
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>{t('admin.returns.index.col.order')}</Th>
                <Th>{t('admin.returns.index.col.customer')}</Th>
                <Th>{t('admin.returns.index.col.status')}</Th>
                <Th>{t('admin.returns.index.col.resolution')}</Th>
                <Th>{t('admin.returns.index.col.items')}</Th>
                <Th>{t('admin.returns.index.col.date')}</Th>
              </tr>
            </THead>
            <TBody>
              {returns.map((ret) => (
                <tr key={ret.id}>
                  <Td>
                    <Link
                      to={`/admin/orders/${ret.orderId}`}
                      className="text-accent hover:underline"
                    >
                      {ret.order?.orderNumber ?? ret.orderId.slice(-8)}
                    </Link>
                  </Td>
                  <Td className="text-text-muted">{ret.order?.email ?? '—'}</Td>
                  <Td>
                    <ReturnStatusBadge status={ret.status} />
                  </Td>
                  <Td className="capitalize">{ret.resolution ?? '—'}</Td>
                  <Td className="text-text-muted">
                    {ret.lines
                      .map(
                        (line) =>
                          line.title ?? t('admin.returns.index.itemFallback')
                      )
                      .join(', ')}
                  </Td>
                  <Td className="text-text-muted">
                    {formatDate(ret.createdAt)}
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(nextPage) => {
              const params = new URLSearchParams(searchParams);
              if (nextPage <= 1) params.delete('page');
              else params.set('page', String(nextPage));
              const query = params.toString();
              return query ? `/admin/returns?${query}` : '/admin/returns';
            }}
          />
        </>
      )}
    </div>
  );
}
