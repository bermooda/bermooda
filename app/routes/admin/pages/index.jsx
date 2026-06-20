import { Link, useLoaderData, useSearchParams } from 'react-router';

import prisma from '#/libs/prisma.server';

import { listPages } from '#/core/content/index.server';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const status = url.searchParams.get('status') || undefined;

  const { pages, total } = await listPages({ status, page, limit: PAGE_SIZE });

  const pageIds = pages.map((p) => p.id);
  const [translations, slugs] =
    pageIds.length > 0
      ? await Promise.all([
          prisma.translation.findMany({
            where: {
              entityType: 'page',
              entityId: { in: pageIds },
              locale: 'en',
              field: 'title',
            },
          }),
          prisma.slug.findMany({
            where: {
              entityType: 'page',
              entityId: { in: pageIds },
              locale: 'en',
            },
          }),
        ])
      : [[], []];

  const titleMap = Object.fromEntries(
    translations.map((t) => [t.entityId, t.value])
  );
  const slugMap = Object.fromEntries(slugs.map((s) => [s.entityId, s.slug]));

  return {
    pages: pages.map((p) => ({
      id: p.id,
      title: titleMap[p.id] ?? '(untitled)',
      slug: slugMap[p.id] ?? null,
      status: p.status,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    status: status ?? 'all',
  };
}

export default function AdminPagesIndexRoute() {
  const { pages, total, page, pageSize, status } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function setStatus(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    params.delete('page');
    setSearchParams(params);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pages
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage CMS pages for the storefront.
          </p>
        </div>
        <Link
          to="/admin/pages/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          New Page
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        {['all', 'draft', 'published'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${
              status === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead className="bg-gray-50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
            {pages.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No pages found.
                </td>
              </tr>
            ) : (
              pages.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {p.title}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {p.slug ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        p.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/pages/${p.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {page > 1 && (
            <Link
              to={`?page=${page - 1}${status !== 'all' ? `&status=${status}` : ''}`}
              className="text-sm text-indigo-600"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              to={`?page=${page + 1}${status !== 'all' ? `&status=${status}` : ''}`}
              className="text-sm text-indigo-600"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
