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
    <Badge tone={status === 'published' ? 'success' : 'warn'}>{label}</Badge>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  function setStatus(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('status');
    else params.set('status', next);
    params.delete('page');
    setSearchParams(params);
  }

  function goToPage(p) {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  }

  const statusFilters = [
    { key: 'all', label: t('admin.pages.status.all') },
    { key: 'draft', label: t('admin.pages.status.draft') },
    { key: 'published', label: t('admin.pages.status.published') },
  ];

  const columns = [
    t('admin.pages.index.col.page'),
    t('admin.pages.index.col.status'),
    t('admin.pages.index.col.updated'),
  ];

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

      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-xs">
        <Toolbar>
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

        <Table className="hidden rounded-none border-0 shadow-none md:block">
          <THead>
            <tr>
              {columns.map((col) => (
                <Th key={col}>{col}</Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {pages.length === 0 && (
              <tr>
                <Td colSpan={3} className="p-0">
                  <EmptyState
                    icon={DocumentTextIcon}
                    title={t('admin.pages.index.emptyTitle')}
                    description={
                      q || status !== 'all'
                        ? t('admin.pages.index.emptyDescriptionSearch')
                        : t('admin.pages.index.emptyDescription')
                    }
                    action={
                      !q &&
                      status === 'all' && (
                        <Link
                          to="/admin/pages/new"
                          className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
                        >
                          <PlusIcon className="h-4 w-4" />
                          {t('admin.pages.index.newButton')}
                        </Link>
                      )
                    }
                    className="border-0 shadow-none"
                  />
                </Td>
              </tr>
            )}
            {pages.map((row) => (
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
                <Td className="whitespace-normal">
                  <span className="block min-w-0">
                    <span className="text-text group-hover:text-accent block truncate font-medium transition-colors">
                      {row.title || row.slug || `${row.id.slice(0, 8)}…`}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate font-mono text-xs">
                      {row.slug ?? row.id.slice(0, 8)}
                    </span>
                  </span>
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                <Td className="tabular-nums">{formatDate(row.updatedAt)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>

        <div className="divide-border divide-y md:hidden">
          {pages.length === 0 ? (
            <EmptyState
              icon={DocumentTextIcon}
              title={t('admin.pages.index.emptyTitle')}
              description={
                q || status !== 'all'
                  ? t('admin.pages.index.emptyDescriptionSearchShort')
                  : t('admin.pages.index.emptyDescription')
              }
              className="border-0 shadow-none"
            />
          ) : (
            pages.map((row) => (
              <Link
                key={row.id}
                to={`/admin/pages/${row.id}`}
                className="hover:bg-surface-2/60 block px-4 py-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-text truncate text-sm font-medium">
                      {row.title || row.slug || `${row.id.slice(0, 8)}…`}
                    </p>
                    <p className="text-text-muted mt-0.5 truncate font-mono text-xs">
                      {row.slug ?? row.id.slice(0, 8)}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <p className="text-text-muted mt-3 text-xs">
                  {t('admin.pages.index.updatedAt', {
                    date: formatDate(row.updatedAt),
                  })}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
