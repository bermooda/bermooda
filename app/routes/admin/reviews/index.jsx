import clsx from 'clsx';
import { Form, useLoaderData, useSearchParams } from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';

import {
  countPendingReviews,
  deleteReview,
  listReviewsForAdmin,
  moderateReview,
} from '#/core/reviews/index.server';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'pending';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));

  const [{ reviews, total }, pendingCount] = await Promise.all([
    listReviewsForAdmin({ status, page, limit: PAGE_SIZE }),
    countPendingReviews(),
  ]);

  const productIds = [...new Set(reviews.map((r) => r.productId))];
  const productTitles =
    productIds.length > 0
      ? await prisma.translation.findMany({
          where: {
            entityType: 'product',
            entityId: { in: productIds },
            locale: 'en',
            field: 'title',
          },
        })
      : [];
  const titleMap = Object.fromEntries(
    productTitles.map((t) => [t.entityId, t.value])
  );

  return {
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      verifiedPurchase: r.verifiedPurchase,
      createdAt: r.createdAt.toISOString(),
      productTitle: titleMap[r.productId] ?? r.productId.slice(0, 8),
      customerName: r.customer.name || r.customer.email,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    status,
    pendingCount,
  };
}

export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const id = formData.get('id')?.toString();

  if (!id) return { error: 'Missing review id' };

  if (intent === 'approve') await moderateReview(id, { status: 'approved' });
  else if (intent === 'reject')
    await moderateReview(id, { status: 'rejected' });
  else if (intent === 'delete') await deleteReview(id);

  return { ok: true };
}

export default function AdminReviewsRoute() {
  const { reviews, total, page, pageSize, status, pendingCount } =
    useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tabs = [
    { key: 'pending', label: `Pending (${pendingCount})` },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
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
      <PageHeader title="Reviews" className="mb-6" />

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
            <Th>Product</Th>
            <Th>Customer</Th>
            <Th>Rating</Th>
            <Th>Review</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </THead>
        <TBody>
          {reviews.length === 0 ? (
            <tr>
              <Td colSpan={5} className="py-8 text-center">
                No reviews in this tab.
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
                      Verified
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
                            Approve
                          </button>
                        </Form>
                        <Form method="post" className="inline">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="intent" value="reject" />
                          <button
                            type="submit"
                            className="text-warn text-sm hover:underline"
                          >
                            Reject
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
                        Delete
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
