// app/routes/admin/products/index.jsx
// Products admin list — paginated table with search, status, variant count,
// category badges and a "New Product" button.

import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Form, Link, useLoaderData, useSearchParams } from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';

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
    <Badge tone={published ? 'success' : 'neutral'}>
      {published ? 'Published' : 'Draft'}
    </Badge>
  );
}

function CategoryBadge({ title }) {
  return <Badge tone="accent">{title}</Badge>;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
      <PageHeader
        title="Products"
        subtitle={`${total} product${total !== 1 ? 's' : ''}`}
        actions={
          <Link
            to="/admin/products/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New Product
          </Link>
        }
        className="mb-6"
      />

      {/* Search */}
      <Form method="get" className="mb-4">
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="text-text-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by slug…"
            className={`${controlClasses} pl-9`}
          />
        </div>
      </Form>

      {/* Table (md+) */}
      <Table className="hidden md:block">
        <THead>
          <tr>
            {['ID', 'Slug', 'Status', 'Variants', 'Categories', 'Created'].map(
              (col) => (
                <Th key={col}>{col}</Th>
              )
            )}
          </tr>
        </THead>
        <TBody>
          {rows.length === 0 && (
            <tr>
              <Td colSpan={6} className="py-8 text-center">
                No products found.
              </Td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id}>
              <Td>
                <Link
                  to={`/admin/products/${row.id}`}
                  className="text-accent font-mono text-xs hover:underline"
                >
                  {row.idPrefix}…
                </Link>
              </Td>
              <Td className="text-text">
                {row.slug ? (
                  <Link
                    to={`/admin/products/${row.id}`}
                    className="hover:underline"
                  >
                    {row.slug}
                  </Link>
                ) : (
                  '—'
                )}
              </Td>
              <Td>
                <StatusBadge published={row.published} />
              </Td>
              <Td className="text-text">{row.variantCount}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {row.categories.map((c) => (
                    <CategoryBadge key={c.id} title={c.title} />
                  ))}
                </div>
              </Td>
              <Td>{formatDate(row.createdAt)}</Td>
            </tr>
          ))}
        </TBody>
      </Table>

      {/* Card list (mobile) */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <Card className="text-text-muted text-center text-sm">
            No products found.
          </Card>
        ) : (
          rows.map((row) => (
            <Card key={row.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to={`/admin/products/${row.id}`}
                  className="text-text min-w-0 truncate text-sm font-medium hover:underline"
                >
                  {row.slug ?? `${row.idPrefix}…`}
                </Link>
                <StatusBadge published={row.published} />
              </div>
              {row.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {row.categories.map((c) => (
                    <CategoryBadge key={c.id} title={c.title} />
                  ))}
                </div>
              )}
              <div className="text-text-muted flex items-center justify-between text-xs">
                <span>
                  {row.variantCount} variant{row.variantCount !== 1 ? 's' : ''}
                </span>
                <span>{formatDate(row.createdAt)}</span>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
