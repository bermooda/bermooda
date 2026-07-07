// GET /api/admin/v1/marketing/segments — list segments
// POST /api/admin/v1/marketing/segments — create segment
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonListResponse,
  parseAdminListPagination,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import { createSegment, listSegments } from '#/core/marketing/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams, {
    limit: 50,
  });

  const { segments, total } = await listSegments({ page, limit });
  return jsonListResponse('segments', { items: segments, total, page, limit });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const segment = await createSegment(parsed.body);
    return Response.json({ segment }, { status: 201 });
  } catch (err) {
    if (err.code === 'NAME_REQUIRED') {
      return jsonDomainError(err);
    }
    throw err;
  }
}
