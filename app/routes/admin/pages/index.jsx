// app/routes/admin/pages/index.jsx
// Pages admin list — sticky-header table with search and status filters.

import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import {
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import { listPagesAdmin } from '#/core/content/index.server';
import { useT } from '#/core/i18n';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import SearchField from '#/components/admin/search-field';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

export async function loader({ request }) {
  const url = new URL(request.url);
  return listPagesAdmin(url.searchParams);
}

/**
 * @param {Object} props
 * @param {string} props.status
 */
function StatusBadge({ status }) {
  const t = useT();
  const label =
    status === 'published'
      ? t('admin.pages.status.published')
      : t('admin.pages.status.draft');
  return (
    <Badge tone={status === 'published' ? 'success' : 'neutral'}>{label}</Badge>
  );
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
 * @param {{ title?: string | null, slug?: string | null, id: string }} row
 * @returns {string}
 */
function pageLabel(row) {
  return row.title || row.slug || `${row.id.slice(0, 8)}…`;
}

export default function AdminPagesIndexRoute() {
  const t = useT();
  const {
    pages,
    total,
    publishedCount,
    draftCount,
    page,
    totalPages,
    status,
    q,
  } = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  /**
   * @param {string} next
   */
  function setStatus(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'all') params.delete('status');
      else params.set('status', next);
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

  const statusFilters = [
    { key: 'all', label: t('admin.pages.status.all') },
    { key: 'draft', label: t('admin.pages.status.draft') },
    { key: 'published', label: t('admin.pages.status.published') },
  ];

  const hasFilter = Boolean(q) || status !== 'all';

  return (
    <div>
      <PageHeader
        title={t('admin.pages.index.title')}
        subtitle={t('admin.pages.index.subtitle')}
        actions={
          <Link
            to="/admin/pages/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.pages.index.newButton')}
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t('admin.pages.index.stat.total')} value={total} />
        <Stat
          label={t('admin.pages.index.stat.published')}
          value={publishedCount}
        />
        <Stat label={t('admin.pages.index.stat.drafts')} value={draftCount} />
      </div>

      <Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
        <SearchField
          defaultValue={q}
          placeholder={t('admin.pages.index.searchPlaceholder')}
          formClassName="w-full sm:max-w-sm"
          hiddenFields={status !== 'all' ? { status } : {}}
        />
        <ToolbarGroup>
          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStatus(s.key)}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  status === s.key
                    ? 'bg-accent text-accent-fg'
                    : 'bg-surface-2 text-text-muted hover:text-text'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-text-muted text-sm">
            {total === 1
              ? t('admin.pages.index.resultsOne', { count: total })
              : t('admin.pages.index.results', { count: total })}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {pages.length === 0 ? (
        <EmptyState
          icon={DocumentTextIcon}
          title={t('admin.pages.index.emptyTitle')}
          description={
            hasFilter
              ? t('admin.pages.index.emptyDescriptionSearch')
              : t('admin.pages.index.emptyDescription')
          }
          action={
            !hasFilter && (
              <Link
                to="/admin/pages/new"
                className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
              >
                <PlusIcon className="h-4 w-4" />
                {t('admin.pages.index.newButton')}
              </Link>
            )
          }
        />
      ) : (
        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.pages.index.col.page')}
              </Th>
              <Th sticky className="px-3 py-3.5">
                {t('admin.pages.index.col.status')}
              </Th>
              <Th sticky className="hidden px-3 py-3.5 md:table-cell">
                {t('admin.pages.index.col.updated')}
              </Th>
              <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
                <span className="sr-only">
                  {t('admin.pages.index.col.edit')}
                </span>
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {pages.map((row) => {
              const label = pageLabel(row);
              return (
                <Tr
                  key={row.id}
                  role="link"
                  tabIndex={0}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/admin/pages/${row.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/admin/pages/${row.id}`);
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
                        {row.slug ?? row.id.slice(0, 8)}
                      </span>
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4">
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td
                    sticky
                    className="hidden px-3 py-4 tabular-nums md:table-cell"
                  >
                    {formatDate(row.updatedAt)}
                  </Td>
                  <Td
                    sticky
                    className="py-4 pr-1 pl-3 text-right text-sm font-medium sm:pr-0"
                  >
                    <Link
                      to={`/admin/pages/${row.id}`}
                      className="text-accent hover:text-accent-hover"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('admin.pages.index.edit')}
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
