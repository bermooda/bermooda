// GET /api/admin/v1/collections/:id — get collection
// PATCH /api/admin/v1/collections/:id — update collection
// DELETE /api/admin/v1/collections/:id — delete collection
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  jsonResourceOr404,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin.server';
import {
  deleteCollection,
  getCollection,
  updateCollection,
} from '#/core/collections/index.server';

const mapCollectionError = createDomainErrorMapper({
  notFound: ['COLLECTION_NOT_FOUND'],
  badRequest: ['COLLECTION_INVALID'],
});

export async function loader({ params }) {
  const collection = await getCollection(params.id);
  return jsonResourceOr404('collection', collection, {
    message: 'Collection not found',
  });
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'PATCH') {
    const parsed = await parseJsonBody(request, {
      invalidMessage: 'Invalid JSON',
    });
    if (parsed.error) return parsed.error;

    try {
      await updateCollection(params.id, parsed.body);
      const collection = await getCollection(params.id);
      return Response.json({ collection });
    } catch (err) {
      if (err.message === 'Slug already taken') {
        return Response.json({ error: err.message }, { status: 409 });
      }
      return mapCollectionError(err);
    }
  }

  try {
    await deleteCollection(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    return mapCollectionError(err);
  }
}
