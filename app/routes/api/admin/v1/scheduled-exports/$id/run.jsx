// POST /api/admin/v1/scheduled-exports/:id/run — queue export run
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  getScheduledExport,
  queueScheduledExport,
} from '#/core/exports/index.server';

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await getScheduledExport(params.id);
    queueScheduledExport({ scheduledExportId: params.id });
    return Response.json({ queued: true }, { status: 202 });
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
