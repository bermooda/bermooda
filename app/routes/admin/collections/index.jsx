import { Link, useLoaderData } from 'react-router';

import prisma from '#/libs/prisma.server';
import PageHeader from '#/components/admin/page-header';
import Button from '#/components/ui/button';

import { listCollections } from '#/core/collections/index.server';

export async function loader() {
  const collections = await listCollections();
  const titles = await prisma.translation.findMany({
    where: {
      entityType: 'collection',
      entityId: { in: collections.map((c) => c.id) },
      locale: 'en',
      field: 'title',
    },
  });
  const titleMap = Object.fromEntries(titles.map((t) => [t.entityId, t.value]));

  return {
    collections: collections.map((collection) => ({
      ...collection,
      title: titleMap[collection.id] ?? collection.handle,
    })),
  };
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
              <Link
                to={`/admin/collections/${c.id}`}
                className="font-medium hover:underline"
              >
                {c.title}
              </Link>
              <p className="text-sm text-stone-500">
                /{c.handle} · {c.collectionType} · {c._count.products} products
              </p>
            </div>
            <Button
              as={Link}
              to={`/admin/collections/${c.id}`}
              variant="secondary"
            >
              Edit
            </Button>
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
