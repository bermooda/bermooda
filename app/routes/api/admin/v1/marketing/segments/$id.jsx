// GET /api/admin/v1/marketing/segments/:id — get segment
// PATCH /api/admin/v1/marketing/segments/:id — update segment
// DELETE /api/admin/v1/marketing/segments/:id — delete segment
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  deleteSegment,
  getSegment,
  updateSegment,
} from '#/core/marketing/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const segment = await getSegment(params.id);
    return Response.json({ segment });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: 'Segment not found' }, { status: 404 });
    }
    throw err;
  }
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method === 'DELETE') {
    try {
      await deleteSegment(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return Response.json({ error: 'Segment not found' }, { status: 404 });
      }
      throw err;
    }
  }

  if (request.method === 'PATCH') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      const segment = await updateSegment(params.id, body);
      return Response.json({ segment });
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return Response.json({ error: 'Segment not found' }, { status: 404 });
      }
      if (err.code === 'NAME_REQUIRED' || err.code === 'NO_CHANGES') {
        return Response.json({ error: err.message, code: err.code }, { status: 422 });
      }
      throw err;
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
