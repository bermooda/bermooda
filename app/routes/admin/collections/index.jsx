import { Link, useLoaderData } from 'react-router';

import { listCollections } from '#/core/collections/index.server';
import { useT } from '#/core/i18n';
import PageHeader from '#/components/admin/page-header';
import Pagination from '#/components/admin/pagination';
import Button from '#/components/ui/button';

const PAGE_SIZE = 20;

export async function loader({ request }) {
  const url = new URL(request.url);
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const { collections, total } = await listCollections({
    page,
    limit: PAGE_SIZE,
  });

  return { collections, total, page };
}

export function meta() {
  return [{ title: 'Collections' }];
}

export default function AdminCollectionsRoute() {
  const t = useT();
  const { collections, total, page } = useLoaderData();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title={t('admin.collections.index.title')}
        subtitle={t('admin.collections.index.subtitle')}
        actions={
          <Button as={Link} to="/admin/collections/new">
            {t('admin.collections.index.newButton')}
          </Button>
        }
      />
      <ul className="divide-y rounded-lg border">
        {collections.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div>
              <Link
                to={`/admin/collections/${c.id}`}
                className="font-medium hover:underline"
              >
                {c.title}
              </Link>
              <p className="text-sm text-stone-500">
                {t('admin.collections.index.meta', {
                  handle: c.handle,
                  type: c.collectionType,
                  count: c._count.products,
                })}
              </p>
            </div>
            <Button
              as={Link}
              to={`/admin/collections/${c.id}`}
              variant="secondary"
            >
              {t('admin.collections.index.edit')}
            </Button>
          </li>
        ))}
        {!collections.length && (
          <li className="px-4 py-8 text-center text-sm text-stone-500">
            {t('admin.collections.index.empty')}
          </li>
        )}
      </ul>
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
