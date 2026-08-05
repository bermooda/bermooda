// app/routes/admin/collections/index.jsx
// Collections admin list — sticky-header table with search.

import { PlusIcon, RectangleStackIcon } from '@heroicons/react/24/outline';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { parseAdminSearchParams } from '#/libs/api/admin-ui/index.server';
import { listCollections } from '#/core/collections/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, q } = parseAdminSearchParams(url.searchParams, {
    limit: PAGE_SIZE,
  });

  const { collections, total } = await listCollections({
    page,
    limit: PAGE_SIZE,
    q: q || undefined,
  });

  return {
    collections,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    q,
  };
}

export function meta() {
  return [{ title: 'Collections' }];
}

/**
 * @param {string} type
 * @param {(key: string) => string} t
 * @returns {string}
 */
function collectionTypeLabel(type, t) {
  const key = `admin.collections.type.${type}`;
  const label = t(key);
  return label === key ? type : label;
}

export default function AdminCollectionsRoute() {
  const t = useT();
  const { collections, total, page, totalPages, q } = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * @param {number} p
   */
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
        title={t('admin.collections.index.title')}
        subtitle={t('admin.collections.index.subtitle')}
        actions={
          <Link
            to="/admin/collections/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.collections.index.newButton')}
          </Link>
        }
      />

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.collections.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
        />
        <ToolbarGroup>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.collections.index.resultsOne', { count: total })
              : t('admin.collections.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {collections.length === 0 ? (
        <EmptyState
          icon={RectangleStackIcon}
          title={
            q
              ? t('admin.collections.index.emptyTitleSearch')
              : t('admin.collections.index.emptyTitle')
          }
          description={
            q
              ? t('admin.collections.index.emptyDescriptionSearch')
              : t('admin.collections.index.emptyDescription')
          }
          action={
            !q && (
              <Link
                to="/admin/collections/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.collections.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.collections.index.col.collection')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.collections.index.col.type')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 sm:table-cell">
                {t('admin.collections.index.col.products')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.collections.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {collections.map((collection) => {
              const label = collection.title || collection.handle;
              return (
                <Tr
                  key={collection.id}
                  role="link"
                  tabIndex={0}
                  className="group cursor-pointer"
                  onClick={() =>
                    navigate(`/admin/collections/${collection.id}`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/admin/collections/${collection.id}`);
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
                        /{collection.handle}
                      </span>
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <Badge
                      tone={
                        collection.collectionType === 'smart'
                          ? 'accent'
                          : 'neutral'
                      }
                    >
                      {collectionTypeLabel(collection.collectionType, t)}
                    </Badge>
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums sm:table-cell"
                  >
                    {collection._count.products}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <Link
                      to={`/admin/collections/${collection.id}`}
                      className="text-accent hover:text-accent-hover"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('admin.collections.index.edit')}
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
