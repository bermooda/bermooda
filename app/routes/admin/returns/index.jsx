// app/routes/admin/returns/index.jsx

import clsx from 'clsx';
import { Link, useLoaderData, useSearchParams } from 'react-router';

import {
  listReturns,
  parseReturnListParams,
  RETURN_STATUSES,
} from '#/core/returns/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';

const PAGE_SIZE = 20;

const STATUS_TONES = {
  requested: 'warn',
  approved: 'accent',
  received: 'accent',
  refunded: 'success',
  exchanged: 'success',
  cancelled: 'neutral',
};

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
  const { returns, total, page, status, returnStatuses } = useLoaderData();
  const [searchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle="Review and manage return requests across orders."
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
          All
        </Link>
        {returnStatuses.map((value) => (
          <Link
            key={value}
            to={`/admin/returns?status=${value}`}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-medium capitalize transition',
              status === value
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-text-muted hover:text-text'
            )}
          >
            {value}
          </Link>
        ))}
      </div>

      {returns.length === 0 ? (
        <EmptyState
          title="No returns"
          description={
            status
              ? `No returns with status "${status}".`
              : 'Return requests from customers will appear here.'
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th>Resolution</Th>
                <Th>Items</Th>
                <Th>Date</Th>
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
                    <Badge tone={STATUS_TONES[ret.status] ?? 'neutral'}>
                      {ret.status}
                    </Badge>
                  </Td>
                  <Td className="capitalize">{ret.resolution ?? '—'}</Td>
                  <Td className="text-text-muted">
                    {ret.lines.map((line) => line.title ?? 'Item').join(', ')}
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
