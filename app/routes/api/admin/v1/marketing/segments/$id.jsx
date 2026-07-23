// GET /api/admin/v1/marketing/segments/:id — get segment
// PATCH /api/admin/v1/marketing/segments/:id — update segment
// DELETE /api/admin/v1/marketing/segments/:id — delete segment
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin/index.server';
import {
  deleteSegment,
  getSegment,
  updateSegment,
} from '#/core/marketing/index.server';

const mapSegmentError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

function segmentNotFoundResponse() {
  return Response.json({ error: 'Segment not found' }, { status: 404 });
}

export async function loader({ params }) {
  try {
    const segment = await getSegment(params.id);
    return Response.json({ segment });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return segmentNotFoundResponse();
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'DELETE') {
    try {
      await deleteSegment(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return segmentNotFoundResponse();
      }
      throw err;
    }
  }

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const segment = await updateSegment(params.id, parsed.body);
    return Response.json({ segment });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return segmentNotFoundResponse();
    }
    return mapSegmentError(err);
  }
}
