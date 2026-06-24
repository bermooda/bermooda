import clsx from 'clsx';
import { Link, useLoaderData, useSearchParams } from 'react-router';

import prisma from '#/libs/prisma.server';
import Badge from '#/components/admin/badge';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Table, { Th, Td, THead, TBody } from '#/components/admin/table';

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
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            New Page
          </Link>
        }
        className="mb-6"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'draft', 'published'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors',
              status === s
                ? 'bg-accent text-accent-fg'
                : 'bg-surface-2 text-text-muted hover:text-text'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <Table>
        <THead>
          <tr>
            <Th>Title</Th>
            <Th>Slug</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </THead>
        <TBody>
          {pages.length === 0 ? (
            <tr>
              <Td colSpan={4} className="py-8 text-center">
                No pages found.
              </Td>
            </tr>
          ) : (
            pages.map((p) => (
              <tr key={p.id}>
                <Td className="text-text font-medium">{p.title}</Td>
                <Td>{p.slug ?? '—'}</Td>
                <Td>
                  <Badge tone={p.status === 'published' ? 'success' : 'warn'}>
                    {p.status}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Link
                    to={`/admin/pages/${p.id}`}
                    className="text-accent text-sm font-medium hover:underline"
                  >
                    Edit
                  </Link>
                </Td>
              </tr>
            ))
          )}
        </TBody>
      </Table>

      <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
    </div>
  );
}
