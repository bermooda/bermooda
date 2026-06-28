import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
} from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import EmptyState from '#/components/admin/empty-state';
import { controlClasses } from '#/components/admin/form/input';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Stat from '#/components/admin/stat';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';
import Toolbar, { ToolbarGroup } from '#/components/admin/toolbar';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const status = url.searchParams.get('status') || undefined;
  const q = url.searchParams.get('q')?.trim() ?? '';

  let pageIds = null;
  if (q) {
    const slugRows = await prisma.slug.findMany({
      where: {
        entityType: 'page',
        slug: { contains: q },
      },
      select: { entityId: true },
    });
    pageIds = slugRows.map((r) => r.entityId);
  }

  const whereClause = {
    ...(status ? { status } : {}),
    ...(pageIds !== null ? { id: { in: pageIds } } : {}),
  };

  const [total, publishedCount, draftCount, pages] = await Promise.all([
    prisma.page.count({ where: whereClause }),
    prisma.page.count({
      where: { ...whereClause, status: 'published' },
    }),
    prisma.page.count({
      where: { ...whereClause, status: 'draft' },
    }),
    prisma.page.findMany({
      where: whereClause,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const ids = pages.map((p) => p.id);
  const [translations, slugs] =
    ids.length > 0
      ? await Promise.all([
          prisma.translation.findMany({
            where: {
              entityType: 'page',
              entityId: { in: ids },
              locale: 'en',
              field: 'title',
            },
          }),
          prisma.slug.findMany({
            where: {
              entityType: 'page',
              entityId: { in: ids },
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
      idPrefix: p.id.slice(0, 8),
      title: titleMap[p.id] ?? null,
      slug: slugMap[p.id] ?? null,
      status: p.status,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    publishedCount,
    draftCount,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
    status: status ?? 'all',
    q,
  };
}

function StatusBadge({ status }) {
  return (
    <Badge tone={status === 'published' ? 'success' : 'warn'}>{status}</Badge>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminPagesIndexRoute() {
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

  return (
    <div>
      <PageHeader
        title="Pages"
        subtitle="Manage CMS pages for the storefront."
        actions={
          <Link
            to="/admin/pages/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            New page
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Total pages" value={total} />
        <Stat label="Published" value={publishedCount} />
        <Stat label="Drafts" value={draftCount} />
      </div>

      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-xs">
        <Toolbar>
          <Form method="get" className="w-full sm:max-w-sm">
            <div className="relative">
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
          <ToolbarGroup>
            <div className="flex flex-wrap gap-1.5">
              {['all', 'draft', 'published'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                    status === s
                      ? 'bg-accent text-accent-fg'
                      : 'bg-surface-2 text-text-muted hover:text-text'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="text-text-muted text-sm">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </ToolbarGroup>
        </Toolbar>

        <Table className="hidden rounded-none border-0 shadow-none md:block">
          <THead>
            <tr>
              {['Page', 'Status', 'Updated'].map((col) => (
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
                    title="No pages found"
                    description={
                      q || status !== 'all'
                        ? 'Try a different search term or clear the filter.'
                        : 'Create your first page to get started.'
                    }
                    action={
                      !q &&
                      status === 'all' && (
                        <Link
                          to="/admin/pages/new"
                          className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
                        >
                          <PlusIcon className="h-4 w-4" />
                          New page
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
                      {row.title || row.slug || `${row.idPrefix}…`}
                    </span>
                    <span className="text-text-muted mt-0.5 block truncate font-mono text-xs">
                      {row.slug ?? row.idPrefix}
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
              title="No pages found"
              description={
                q || status !== 'all'
                  ? 'Try a different search term.'
                  : 'Create your first page to get started.'
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
                      {row.title || row.slug || `${row.idPrefix}…`}
                    </p>
                    <p className="text-text-muted mt-0.5 truncate font-mono text-xs">
                      {row.slug ?? row.idPrefix}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <p className="text-text-muted mt-3 text-xs">
                  Updated {formatDate(row.updatedAt)}
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
