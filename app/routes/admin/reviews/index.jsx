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
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';

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
  const { reviews, total, page, pageSize, status, pendingCount } =
    useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tabs = [
    {
      key: 'pending',
      label: t('admin.reviews.index.tab.pending', { count: pendingCount }),
    },
    { key: 'approved', label: t('admin.reviews.index.tab.approved') },
    { key: 'rejected', label: t('admin.reviews.index.tab.rejected') },
    { key: 'all', label: t('admin.reviews.index.tab.all') },
  ];

  function setTab(next) {
    const params = new URLSearchParams(searchParams);
    params.set('status', next);
    params.delete('page');
    setSearchParams(params);
  }

  function goToPage(p) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  }

  return (
    <div>
      <PageHeader title={t('admin.reviews.index.title')} className="mb-6" />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              status === tab.key
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-text-muted hover:text-text'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Table>
        <THead>
          <tr>
            <Th>{t('admin.reviews.index.col.product')}</Th>
            <Th>{t('admin.reviews.index.col.customer')}</Th>
            <Th>{t('admin.reviews.index.col.rating')}</Th>
            <Th>{t('admin.reviews.index.col.review')}</Th>
            <Th className="text-right">
              {t('admin.reviews.index.col.actions')}
            </Th>
          </tr>
        </THead>
        <TBody>
          {reviews.length === 0 ? (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                {t('admin.reviews.index.empty')}
              </Td>
            </tr>
          ) : (
            reviews.map((r) => (
              <tr key={r.id}>
                <Td className="text-text">{r.productTitle}</Td>
                <Td>{r.customerName}</Td>
                <Td>
                  <span className="text-warn">{'★'.repeat(r.rating)}</span>
                  {r.verifiedPurchase && (
                    <Badge tone="success" className="ml-2">
                      {t('admin.reviews.index.verified')}
                    </Badge>
                  )}
                </Td>
                <Td className="max-w-xs truncate whitespace-normal">
                  {r.body}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-3">
                    {r.status === 'pending' && (
                      <>
                        <Form method="post" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="intent" value="approve" />
                          <button
                            type="submit"
                            className="text-success text-sm hover:underline"
                          >
                            {t('admin.reviews.index.approve')}
                          </button>
                        </Form>
                        <Form method="post" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="intent" value="reject" />
                          <button
                            type="submit"
                            className="text-warn text-sm hover:underline"
                          >
                            {t('admin.reviews.index.reject')}
                          </button>
                        </Form>
                      </>
                    )}
                    <Form method="post" className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="intent" value="delete" />
                      <button
                        type="submit"
                        className="text-danger text-sm hover:underline"
                      >
                        {t('admin.reviews.index.delete')}
                      </button>
                    </Form>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </TBody>
      </Table>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
