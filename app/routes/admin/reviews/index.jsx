import clsx from 'clsx';
import { Form, useLoaderData, useSearchParams } from 'react-router';

import prisma from '#/libs/prisma.server';

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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Reviews
      </h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-medium',
              status === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-zinc-800'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead className="bg-gray-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Rating
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                Review
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
            {reviews.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No reviews in this tab.
                </td>
              </tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-sm">{r.productTitle}</td>
                  <td className="px-4 py-3 text-sm">{r.customerName}</td>
                  <td className="px-4 py-3 text-sm">
                    {'★'.repeat(r.rating)}
                    {r.verifiedPurchase && (
                      <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">
                        Verified
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                    {r.body}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {r.status === 'pending' && (
                        <>
                          <Form method="post" className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input
                              type="hidden"
                              name="intent"
                              value="approve"
                            />
                            <button
                              type="submit"
                              className="text-sm text-green-600"
                            >
                              Approve
                            </button>
                          </Form>
                          <Form method="post" className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="intent" value="reject" />
                            <button
                              type="submit"
                              className="text-sm text-amber-600"
                            >
                              Reject
                            </button>
                          </Form>
                        </>
                      )}
                      <Form method="post" className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="intent" value="delete" />
                        <button type="submit" className="text-sm text-red-600">
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Page {page} of {totalPages}
        </p>
      )}
    </div>
  );
}
