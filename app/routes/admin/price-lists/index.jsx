// app/routes/admin/price-lists/index.jsx

import { PlusIcon } from '@heroicons/react/24/outline';
import { Link, useLoaderData } from 'react-router';

import { useT } from '#/core/i18n';
import { listPriceLists } from '#/core/pricing/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';

export async function loader() {
  const priceLists = await listPriceLists();
  return { priceLists };
}

export default function AdminPriceListsRoute() {
  const t = useT();
  const { priceLists } = useLoaderData();

  return (
    <div>
      <PageHeader
        title={t('admin.priceLists.index.title')}
        subtitle={t('admin.priceLists.index.subtitle')}
        actions={
          <Link
            to="/admin/price-lists/new"
            className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.priceLists.index.newButton')}
          </Link>
        }
        className="mb-6"
      />

      {priceLists.length === 0 ? (
        <EmptyState
          title={t('admin.priceLists.index.emptyTitle')}
          description={t('admin.priceLists.index.emptyDescription')}
          action={
            <Link
              to="/admin/price-lists/new"
              className="bg-accent text-accent-fg hover:bg-accent-hover inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold shadow-sm transition"
            >
              <PlusIcon className="h-4 w-4" />
              {t('admin.priceLists.index.newButton')}
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {priceLists.map((list) => (
            <Card key={list.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/admin/price-lists/${list.id}`}
                  className="text-text hover:text-accent text-lg font-semibold"
                >
                  {list.name}
                </Link>
                <Badge tone="neutral">{list.currency}</Badge>
                {list.customerGroup && (
                  <Badge tone="accent">{list.customerGroup.name}</Badge>
                )}
              </div>
              <p className="text-text-muted mt-1 text-sm">
                {t('admin.priceLists.index.meta', {
                  priority: list.priority,
                  count: list._count.entries,
                })}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
