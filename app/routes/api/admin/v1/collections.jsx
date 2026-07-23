// GET /api/admin/v1/collections — list collections
// POST /api/admin/v1/collections — create collection
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  jsonListResponse,
  parseAdminListPagination,
  parseBooleanQueryParam,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  createCollection,
  getCollection,
  listCollections,
} from '#/core/collections/index.server';

const mapCollectionError = createDomainErrorMapper({
  badRequest: ['COLLECTION_INVALID'],
});

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams);
  const q = url.searchParams.get('q') ?? undefined;
  const publishedOnly = parseBooleanQueryParam(url.searchParams, 'published');

  const { collections, total } = await listCollections({
    page,
    limit,
    q,
    publishedOnly,
  });

  return jsonListResponse('collections', {
    items: collections,
    total,
    page,
    limit,
  });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    const collection = await createCollection(body);
    const hydrated = await getCollection(collection.id);
    return Response.json(
      { collection: hydrated ?? collection },
      { status: 201 }
    );
  } catch (err) {
    if (err.message === 'Slug already taken') {
      return Response.json({ error: err.message }, { status: 409 });
    }
    return mapCollectionError(err);
  }
}
