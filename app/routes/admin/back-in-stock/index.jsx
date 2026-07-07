// app/routes/admin/back-in-stock/index.jsx
// Back-in-stock subscription admin UI.

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Form, useLoaderData, useSearchParams } from 'react-router';

import {
  deleteBackInStockSubscription,
  loadBackInStockAdminIndexData,
  parseDeleteSubscriptionFromForm,
} from '#/core/back-in-stock/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const data = await loadBackInStockAdminIndexData({
    request,
    pageSize: PAGE_SIZE,
  });
  const url = new URL(request.url);

  return {
    ...data,
    pageSize: PAGE_SIZE,
    status: url.searchParams.get('status') ?? 'pending',
    q: url.searchParams.get('q')?.trim() ?? '',
  };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const { id } = parseDeleteSubscriptionFromForm(formData);
    await deleteBackInStockSubscription(id);
    return { ok: true };
  } catch (err) {
    return { error: err.message ?? 'Could not delete subscription.' };
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function AdminBackInStockRoute() {
  const { subscriptions, total, page, pageSize, status, q } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'notified', label: 'Notified' },
    { key: 'all', label: 'All' },
  ];

  function setTab(next) {
    const params = new URLSearchParams(searchParams);
    params.set('status', next);
    params.delete('page');
    setSearchParams(params);
  }

  function goToPage(nextPage) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params);
  }

  return (
    <div>
      <PageHeader
        title="Back in stock"
        subtitle="Customer email subscriptions for out-of-stock variants."
        className="mb-6"
      />

      <div className="border-border mb-4 flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={clsx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
              status === tab.key
                ? 'border-accent text-text'
                : 'text-text-muted hover:text-text border-transparent'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Toolbar className="mb-4">
        <ToolbarGroup>
          <Form method="get" className="relative">
            <input type="hidden" name="status" value={status} />
            <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by email…"
              className={`${controlClasses} w-64 pl-9`}
            />
          </Form>
        </ToolbarGroup>
      </Toolbar>

      <h2 className="text-text mb-3 text-lg font-semibold">
        Subscriptions ({total})
      </h2>

      {subscriptions.length === 0 ? (
        <EmptyState
          title={
            q ? 'No subscriptions match your search' : 'No subscriptions yet'
          }
          description={
            q
              ? 'Try a different email or clear the search.'
              : 'Customers can subscribe from product pages when a variant is out of stock.'
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>Product</Th>
                <Th>Variant</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <TBody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <Td>{subscription.productTitle ?? '—'}</Td>
                  <Td>{subscription.variantSku ?? subscription.variantId}</Td>
                  <Td>{subscription.email}</Td>
                  <Td>
                    <Badge
                      tone={subscription.notifiedAt ? 'neutral' : 'warning'}
                    >
                      {subscription.notifiedAt ? 'Notified' : 'Pending'}
                    </Badge>
                  </Td>
                  <Td>{formatDate(subscription.createdAt)}</Td>
                  <Td className="text-right">
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={subscription.id} />
                      <button
                        type="submit"
                        className="text-danger text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </Form>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            className="mt-6"
            onPageChange={goToPage}
          />
        </>
      )}
    </div>
  );
}

export const meta = () => [{ title: 'Back in stock — Admin' }];
