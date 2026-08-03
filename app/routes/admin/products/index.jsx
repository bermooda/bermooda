// app/routes/admin/products/index.jsx
// Products admin list — sticky-header table (Tailwind Plus pattern) with
// search, status, variant count, category badges and a "New Product" button.

import { CubeIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { loadProductsAdminIndexData } from '#/core/catalog/admin/index.server';
import { useT } from '#/core/i18n';
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

/**
 * @param {Object} props
 * @param {boolean} props.published
 */
function StatusBadge({ published }) {
  const t = useT();
  return (
    <Badge tone={published ? 'success' : 'neutral'}>
      {published
        ? t('admin.products.status.published')
        : t('admin.products.status.draft')}
    </Badge>
  );
}

/**
 * @param {Object} props
 * @param {string} props.title
 */
function CategoryBadge({ title }) {
  return <Badge tone="accent">{title}</Badge>;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * @param {{ title?: string | null, slug?: string | null, idPrefix: string }} row
 * @returns {string}
 */
function productLabel(row) {
  return row.title || row.slug || `${row.idPrefix}…`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminProductsRoute() {
  const t = useT();
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
        title={t('admin.products.index.title')}
        subtitle={t('admin.products.index.subtitle')}
        actions={
          <Link
            to="/admin/products/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.products.index.newButton')}
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t('admin.products.index.stat.total')} value={total} />
        <Stat
          label={t('admin.products.index.stat.published')}
          value={publishedCount}
        />
        <Stat
          label={t('admin.products.index.stat.drafts')}
          value={draftCount}
        />
      </div>

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.products.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.products.index.resultsOne', { count: total })
              : t('admin.products.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          icon={CubeIcon}
          title={t('admin.products.index.emptyTitle')}
          description={
            q
              ? t('admin.products.index.emptyDescriptionSearch')
              : t('admin.products.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/products/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.products.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.products.index.col.product')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.products.index.col.status')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.products.index.col.variants')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 lg:table-cell">
                {t('admin.products.index.col.categories')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.products.index.col.created')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.products.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {rows.map((row) => {
              const label = productLabel(row);
              return (
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
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block min-w-0">
                      <span className="group-hover:text-accent block truncate font-medium transition-colors">
                        {label}
                      </span>
                      <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
                        {row.slug ?? row.idPrefix}
                      </span>
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <StatusBadge published={row.published} />
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums sm:table-cell"
                  >
                    {row.variantCount}
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 whitespace-normal lg:table-cell"
                  >
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
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {formatDate(row.createdAt)}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <Link
                      to={`/admin/products/${row.id}`}
                      className="text-accent hover:text-accent-hover"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('admin.products.index.edit')}
                      <span className="sr-only">, {label}</span>
                    </Link>
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
