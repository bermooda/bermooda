// app/routes/admin/back-in-stock/index.jsx
// Back-in-stock subscription admin list — sticky table with status tabs.

import { BellAlertIcon } from '@heroicons/react/24/outline';
import { Form, useLoaderData, useSearchParams } from 'react-router';

import {
  deleteBackInStockSubscription,
  loadBackInStockAdminIndexData,
  parseDeleteSubscriptionFromForm,
} from '#/core/back-in-stock/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Tabs from '#/components/admin/tabs';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;
const TAB_KEYS = /** @type {const} */ (['pending', 'notified', 'all']);

export async function loader({ request }) {
  const data = await loadBackInStockAdminIndexData({
    request,
    pageSize: PAGE_SIZE,
  });
  const url = new URL(request.url);

  return {
    ...data,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(data.total / PAGE_SIZE),
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

/**
 * @param {string | Date | null | undefined} value
 * @returns {string}
 */
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminBackInStockRoute() {
  const t = useT();
  const { subscriptions, total, page, totalPages, status, q } = useLoaderData();
  const [, setSearchParams] = useSearchParams();

  const tabLabels = TAB_KEYS.map((key) =>
    t(`admin.backInStock.index.tab.${key}`)
  );
  const activeTab = Math.max(0, TAB_KEYS.indexOf(status));

  /**
   * @param {string} next
   */
  function setTab(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('status', next);
      params.delete('page');
      return params;
    });
  }

  /**
   * @param {number} nextPage
   */
  function goToPage(nextPage) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(nextPage));
      return params;
    });
  }

  return (
    <div>
      <PageHeader
        title={t('admin.backInStock.index.title')}
        subtitle={t('admin.backInStock.index.subtitle')}
      />

      <Tabs
        tabs={tabLabels}
        active={activeTab}
        onChange={(index) => setTab(TAB_KEYS[index])}
        className="mb-4"
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.backInStock.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
          hiddenFields={{ status }}
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.backInStock.index.resultsOne', { count: total })
              : t('admin.backInStock.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={BellAlertIcon}
          title={
            q
              ? t('admin.backInStock.index.emptyTitleSearch')
              : t('admin.backInStock.index.emptyTitle')
          }
          description={
            q
              ? t('admin.backInStock.index.emptyDescriptionSearch')
              : t('admin.backInStock.index.emptyDescription')
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.backInStock.index.col.product')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.backInStock.index.col.variant')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.backInStock.index.col.email')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.backInStock.index.col.status')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.backInStock.index.col.created')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.backInStock.index.col.actions')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {subscriptions.map((subscription) => {
              const label = subscription.productTitle ?? '—';
              return (
                <Tr key={subscription.id}>
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="block truncate font-medium">
                        {label}
                      </span>
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal sm:hidden">
                        {subscription.variantSku ?? subscription.variantId}
                      </span>
                    </span>
                  </Td>
                  <Td
                    sticky
                    className="text-text-muted hidden px-3 py-4 font-mono text-sm sm:table-cell"
                  >
                    {subscription.variantSku ?? subscription.variantId}
                  </Td>
                  <Td sticky className="px-3 py-4">
                    {subscription.email}
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <Badge tone={subscription.notifiedAt ? 'neutral' : 'warn'}>
                      {subscription.notifiedAt
                        ? t('admin.backInStock.index.status.notified')
                        : t('admin.backInStock.index.status.pending')}
                    </Badge>
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {formatDate(subscription.createdAt)}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={subscription.id} />
                      <button
                        type="submit"
                        className="text-danger hover:text-danger/80"
                      >
                        {t('admin.backInStock.index.remove')}
                        <span className="sr-only">, {label}</span>
                      </button>
                    </Form>
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

export const meta = () => [{ title: 'Back in stock — Admin' }];
