// app/routes/admin/reviews/index.jsx
// Reviews admin list — sticky-header table with status filters and moderation.

import { StarIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Form, useLoaderData, useSearchParams } from 'react-router';

import { useT } from '#/core/i18n';
import {
  countPendingReviews,
  deleteReview,
  listReviews,
  moderateReview,
  parseReviewListParams,
  parseReviewModerationFromForm,
  REVIEW_STATUSES,
} from '#/core/reviews/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const params = parseReviewListParams({
    ...Object.fromEntries(url.searchParams.entries()),
    status,
    limit: String(PAGE_SIZE),
  });

  const [{ reviews, total, page }, pendingCount] = await Promise.all([
    listReviews(params),
    countPendingReviews(),
  ]);

  return {
    reviews,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    status,
    pendingCount,
    reviewStatuses: REVIEW_STATUSES,
  };
}

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const {
      id,
      status,
      delete: shouldDelete,
    } = parseReviewModerationFromForm(formData);

    if (shouldDelete) {
      await deleteReview(id);
    } else {
      await moderateReview(id, { status });
    }

    return { ok: true };
  } catch (err) {
    return { error: err.message ?? 'Could not update review.' };
  }
}

export default function AdminReviewsRoute() {
  const t = useT();
  const { reviews, total, page, totalPages, status, pendingCount } =
    useLoaderData();
  const [, setSearchParams] = useSearchParams();

  const tabs = [
    {
      key: 'pending',
      label: t('admin.reviews.index.tab.pending', { count: pendingCount }),
    },
    { key: 'approved', label: t('admin.reviews.index.tab.approved') },
    { key: 'rejected', label: t('admin.reviews.index.tab.rejected') },
    { key: 'all', label: t('admin.reviews.index.tab.all') },
  ];

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
   * @param {number} p
   */
  function goToPage(p) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('page', String(p));
      return params;
    });
  }

  return (
    <div>
      <PageHeader
        title={t('admin.reviews.index.title')}
        subtitle={t('admin.reviews.index.subtitle')}
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <ToolbarGroup>
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTab(tab.key)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  status === tab.key
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text-muted hover:text-text'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </ToolbarGroup>
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.reviews.index.resultsOne', { count: total })
              : t('admin.reviews.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {reviews.length === 0 ? (
        <EmptyState
          icon={StarIcon}
          title={t('admin.reviews.index.emptyTitle')}
          description={t('admin.reviews.index.emptyDescription')}
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.reviews.index.col.product')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.reviews.index.col.customer')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.reviews.index.col.rating')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.reviews.index.col.review')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.reviews.index.col.actions')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {reviews.map((r) => (
              <Tr key={r.id}>
                <Td
                  sticky
                  className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                >
                  <span className="block min-w-0">
                    <span className="block truncate font-medium">
                      {r.productTitle}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate text-xs font-normal sm:hidden">
                      {r.customerName}
                    </span>
                  </span>
                </Td>
                <Td sticky className="hidden px-3 py-4 sm:table-cell">
                  {r.customerName}
                </Td>
                <Td sticky className="px-3 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-warn tabular-nums">
                      {'★'.repeat(r.rating)}
                    </span>
                    {r.verifiedPurchase ? (
                      <Badge tone="success">
                        {t('admin.reviews.index.verified')}
                      </Badge>
                    ) : null}
                  </div>
                </Td>
                <Td
                  sticky
                  className="text-text-muted hidden max-w-xs truncate px-3 py-4 whitespace-normal md:table-cell"
                >
                  {r.body}
                </Td>
                <Td
                  sticky
                  className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                >
                  <div className="flex flex-wrap justify-end gap-3">
                    {r.status === 'pending' ? (
                      <>
                        <Form method="post" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="intent" value="approve" />
                          <button
                            type="submit"
                            className="text-success hover:text-success/80"
                          >
                            {t('admin.reviews.index.approve')}
                            <span className="sr-only">, {r.productTitle}</span>
                          </button>
                        </Form>
                        <Form method="post" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="intent" value="reject" />
                          <button
                            type="submit"
                            className="text-warn hover:text-warn/80"
                          >
                            {t('admin.reviews.index.reject')}
                            <span className="sr-only">, {r.productTitle}</span>
                          </button>
                        </Form>
                      </>
                    ) : null}
                    <Form method="post" className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="intent" value="delete" />
                      <button
                        type="submit"
                        className="text-danger hover:text-danger/80"
                      >
                        {t('admin.reviews.index.delete')}
                        <span className="sr-only">, {r.productTitle}</span>
                      </button>
                    </Form>
                  </div>
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
