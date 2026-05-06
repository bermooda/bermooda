// app/routes/admin/products/index.jsx
// Products admin list — paginated table with search, status, variant count,
// category badges and a "New Product" button.

import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const q = url.searchParams.get('q')?.trim() ?? '';

  // For slug search, look up product IDs that match
  let productIds = null;
  if (q) {
    const slugRows = await prisma.slug.findMany({
      where: {
        entityType: 'product',
        slug: { contains: q },
      },
      select: { entityId: true },
    });
    productIds = slugRows.map((r) => r.entityId);
  }

  const whereClause = productIds !== null ? { id: { in: productIds } } : {};

  const [total, products] = await Promise.all([
    prisma.product.count({ where: whereClause }),
    prisma.product.findMany({
      where: whereClause,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        variants: { select: { id: true } },
        categories: {
          include: {
            category: true,
          },
        },
      },
    }),
  ]);

  // Fetch translations for category names
  const categoryIds = [
    ...new Set(products.flatMap((p) => p.categories.map((c) => c.categoryId))),
  ];

  const categoryTranslations =
    categoryIds.length > 0
      ? await prisma.translation.findMany({
          where: {
            entityType: 'category',
            entityId: { in: categoryIds },
            locale: 'en',
            field: 'title',
          },
        })
      : [];

  const catTitleMap = Object.fromEntries(
    categoryTranslations.map((t) => [t.entityId, t.value])
  );

  // Fetch slugs for display
  const productIdList = products.map((p) => p.id);
  const slugs =
    productIdList.length > 0
      ? await prisma.slug.findMany({
          where: {
            entityType: 'product',
            entityId: { in: productIdList },
            locale: 'en',
          },
        })
      : [];
  const slugMap = Object.fromEntries(slugs.map((s) => [s.entityId, s.slug]));

  const rows = products.map((p) => ({
    id: p.id,
    idPrefix: p.id.slice(0, 8),
    slug: slugMap[p.id] ?? null,
    published: p.publishedAt !== null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    variantCount: p.variants.length,
    categories: p.categories.map((c) => ({
      id: c.categoryId,
      title: catTitleMap[c.categoryId] ?? c.categoryId.slice(0, 6),
    })),
    createdAt: p.createdAt.toISOString(),
  }));

  return {
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    q,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ published }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        published
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
      )}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

function CategoryBadge({ title }) {
  return (
    <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
      {title}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminProductsRoute() {
  const { rows, total, page, totalPages, q } = useLoaderData();
  const [, setSearchParams] = useSearchParams();

  function goToPage(p) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Products
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total} product{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <PlusIcon className="h-4 w-4" />
          New Product
        </Link>
      </div>

      {/* Search */}
      <Form method="get" className="mb-4">
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by slug…"
            className="w-full rounded-md border-0 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 shadow-sm ring-1 ring-gray-300 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-600 focus:ring-inset dark:bg-zinc-800 dark:text-white dark:ring-zinc-700 dark:placeholder:text-zinc-500"
          />
        </div>
      </Form>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-zinc-900 dark:ring-zinc-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead>
            <tr className="bg-gray-50 dark:bg-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Variants
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Categories
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-zinc-400">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-400 dark:text-zinc-500"
                >
                  No products found.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 dark:hover:bg-zinc-800/60"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/products/${row.id}`}
                    className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {row.idPrefix}…
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                  {row.slug ? (
                    <Link
                      to={`/admin/products/${row.id}`}
                      className="hover:underline"
                    >
                      {row.slug}
                    </Link>
                  ) : (
                    <span className="text-gray-400 dark:text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge published={row.published} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-zinc-300">
                  {row.variantCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.categories.map((c) => (
                      <CategoryBadge key={c.id} title={c.title} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400">
                  {new Date(row.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-zinc-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-40 dark:ring-zinc-700 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
