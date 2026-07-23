// app/routes/admin/products/index.jsx
// Products admin list — paginated table with search, status, variant count,
// category badges and a "New Product" button.

import { CubeIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { loadProductsAdminIndexData } from '#/core/catalog/admin/index.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, q } = parseAdminSearchParams(url.searchParams, {
    limit: PAGE_SIZE,
  });

  return loadProductsAdminIndexData({ page, limit: PAGE_SIZE, q });
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
  const { rows, total, publishedCount, draftCount, page, totalPages, q } =
    useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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
        subtitle="Manage your catalog, variants, and pricing."
        actions={
          <Link
            to="/admin/products/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New product
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total products" value={total} />
        <Stat label="Published" value={publishedCount} />
        <Stat label="Drafts" value={draftCount} />
      </div>

      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-xs">
        <Toolbar>
          <SearchField
            defaultValue={q}
            placeholder="Search by slug…"
            formClassName="w-full sm:max-w-sm"
          />
          <ToolbarGroup>
            <span className="text-text-muted text-sm">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </ToolbarGroup>
        </Toolbar>

        {/* Table (md+) */}
        <Table className="hidden rounded-none border-0 shadow-none md:block">
          <THead>
            <tr>
              {['Product', 'Status', 'Variants', 'Categories', 'Created'].map(
                (col) => (
                  <Th key={col}>{col}</Th>
                )
              )}
            </tr>
          </THead>
          <TBody>
            {rows.length === 0 && (
              <tr>
                <Td colSpan={5} className="p-0">
                  <EmptyState
                    icon={CubeIcon}
                    title="No products found"
                    description={
                      q
                        ? 'Try a different search term or clear the filter.'
                        : 'Create your first product to start selling.'
                    }
                    action={
                      !q && (
                        <Link
                          to="/admin/products/new"
                          className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
                        >
                          <PlusIcon className="h-4 w-4" />
                          New product
                        </Link>
                      )
                    }
                    className="border-0 shadow-none"
                  />
                </Td>
              </tr>
            )}
            {rows.map((row) => (
              <Tr
                key={row.id}
                role="link"
                tabIndex={0}
                className="group cursor-pointer"
                onClick={() => navigate(`/admin/products/${row.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/admin/products/${row.id}`);
                  }
                }}
              >
                <Td className="whitespace-normal">
                  <span className="block min-w-0">
                    <span className="text-text group-hover:text-accent block truncate font-medium transition-colors">
                      {row.title || row.slug || `${row.idPrefix}…`}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate font-mono text-xs">
                      {row.slug ?? row.idPrefix}
                    </span>
                  </span>
                </Td>
                <Td>
                  <StatusBadge published={row.published} />
                </Td>
                <Td className="tabular-nums">{row.variantCount}</Td>
                <Td className="whitespace-normal">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {row.categories.length === 0 ? (
                      <span className="text-text-muted text-xs">—</span>
                    ) : (
                      row.categories.map((c) => (
                        <CategoryBadge key={c.id} title={c.title} />
                      ))
                    )}
                  </div>
                </Td>
                <Td className="tabular-nums">{formatDate(row.createdAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>

        {/* Card list (mobile) */}
        <div className="divide-border divide-y md:hidden">
          {rows.length === 0 ? (
            <EmptyState
              icon={CubeIcon}
              title="No products found"
              description={
                q
                  ? 'Try a different search term.'
                  : 'Create your first product to start selling.'
              }
              className="border-0 shadow-none"
            />
          ) : (
            rows.map((row) => (
              <Link
                key={row.id}
                to={`/admin/products/${row.id}`}
                className="hover:bg-surface-2/60 block px-4 py-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-text truncate text-sm font-medium">
                      {row.title || row.slug || `${row.idPrefix}…`}
                    </p>
                    <p className="text-text-muted mt-0.5 truncate font-mono text-xs">
                      {row.slug ?? row.idPrefix}
                    </p>
                  </div>
                  <StatusBadge published={row.published} />
                </div>
                {row.categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {row.categories.map((c) => (
                      <CategoryBadge key={c.id} title={c.title} />
                    ))}
                  </div>
                )}
                <div className="text-text-muted mt-3 flex items-center justify-between text-xs">
                  <span>
                    {row.variantCount} variant
                    {row.variantCount !== 1 ? 's' : ''}
                  </span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
