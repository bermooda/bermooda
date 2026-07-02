import { Link, useLoaderData } from 'react-router';

import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import { listCollections } from '#/core/collections/index.server';

export async function loader() {
  const collections = await listCollections();
  return { collections };
}

export function meta() {
  return [{ title: 'Collections' }];
}

export default function AdminCollectionsRoute() {
  const { collections } = useLoaderData();

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Manual and smart product groupings."
        actions={
          <Button as={Link} to="/admin/collections/new">
            New collection
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
              <p className="font-medium">{c.handle}</p>
              <p className="text-sm text-stone-500">
                {c.collectionType} · {c._count.products} products
              </p>
            </div>
          </li>
        ))}
        {!collections.length && (
          <li className="px-4 py-8 text-center text-sm text-stone-500">
            No collections yet.
          </li>
        )}
      </ul>
    </div>
  );
}
