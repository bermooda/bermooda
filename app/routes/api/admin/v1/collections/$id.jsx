// GET /api/admin/v1/collections/:id — get collection
// PATCH /api/admin/v1/collections/:id — update collection
// DELETE /api/admin/v1/collections/:id — delete collection
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';

import {
  deleteCollection,
  getCollection,
  updateCollection,
} from '#/core/collections/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  const collection = await getCollection(params.id);
  if (!collection) {
    return Response.json({ error: 'Collection not found' }, { status: 404 });
  }

  return Response.json({ collection });
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method === 'PATCH') {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      await updateCollection(params.id, body);
      const collection = await getCollection(params.id);
      return Response.json({ collection });
    } catch (err) {
      if (err.code === 'COLLECTION_NOT_FOUND') {
        return Response.json({ error: err.message }, { status: 404 });
      }
      if (err.code === 'COLLECTION_INVALID') {
        return Response.json({ error: err.message }, { status: 400 });
      }
      if (err.message === 'Slug already taken') {
        return Response.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
  }

  if (request.method === 'DELETE') {
    try {
      await deleteCollection(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      if (err.code === 'COLLECTION_NOT_FOUND') {
        return Response.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
