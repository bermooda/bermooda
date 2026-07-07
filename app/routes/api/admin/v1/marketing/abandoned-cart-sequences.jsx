// GET /api/admin/v1/marketing/abandoned-cart-sequences — list sequence steps
// POST /api/admin/v1/marketing/abandoned-cart-sequences — create sequence step
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonListResponse,
  parseAdminListPagination,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  createAbandonedCartSequence,
  listAbandonedCartSequences,
} from '#/core/marketing/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams, {
    limit: 50,
  });

  const { sequences, total } = await listAbandonedCartSequences({
    page,
    limit,
  });
  return jsonListResponse('sequences', {
    items: sequences,
    total,
    page,
    limit,
  });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const sequence = await createAbandonedCartSequence(parsed.body);
    return Response.json({ sequence }, { status: 201 });
  } catch (err) {
    if (err.code === 'SEQUENCE_INVALID') {
      return jsonDomainError(err);
    }
    throw err;
  }
}
