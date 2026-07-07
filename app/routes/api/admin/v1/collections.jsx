// GET /api/admin/v1/collections — list collections
// POST /api/admin/v1/collections — create collection
// Requires admin-scoped API key.

import {
  createCollection,
  getCollection,
  listCollections,
} from '#/core/collections/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const q = url.searchParams.get('q') ?? undefined;
  const publishedOnly = url.searchParams.has('published')
    ? url.searchParams.get('published') === 'true'
    : undefined;

  const { collections, total } = await listCollections({
    page,
    limit,
    q,
    publishedOnly,
  });

  return Response.json({ collections, total, page, limit });
}

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const collection = await createCollection(body);
    const hydrated = await getCollection(collection.id);
    return Response.json(
      { collection: hydrated ?? collection },
      { status: 201 }
    );
  } catch (err) {
    if (err.code === 'COLLECTION_INVALID') {
      return Response.json({ error: err.message }, { status: 400 });
    }
    if (err.message === 'Slug already taken') {
      return Response.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
