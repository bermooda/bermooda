// GET /api/admin/v1/scheduled-exports/:id — get scheduled export
// DELETE /api/admin/v1/scheduled-exports/:id — delete scheduled export
// Requires admin-scoped API key.

import {
  deleteScheduledExport,
  getScheduledExport,
} from '#/core/exports/index.server';

export async function loader({ params }) {
  try {
    const scheduledExport = await getScheduledExport(params.id);
    return Response.json({ scheduledExport });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json(
        { error: 'Scheduled export not found' },
        { status: 404 }
      );
    }
    throw err;
  }
}

export async function action({ request, params }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await deleteScheduledExport(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json(
        { error: 'Scheduled export not found' },
        { status: 404 }
      );
    }
    throw err;
  }
}
