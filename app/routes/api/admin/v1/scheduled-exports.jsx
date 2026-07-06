// GET /api/admin/v1/scheduled-exports — list scheduled exports
// POST /api/admin/v1/scheduled-exports — create scheduled export
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  EXPORT_SCHEDULES,
  EXPORT_TYPES,
  createScheduledExport,
  listScheduledExports,
} from '#/core/exports/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    100
  );

  const result = await listScheduledExports({ page, limit });
  return Response.json({
    ...result,
    exportTypes: EXPORT_TYPES,
    exportSchedules: EXPORT_SCHEDULES,
  });
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const scheduledExport = await createScheduledExport(body);
    return Response.json({ scheduledExport }, { status: 201 });
  } catch (err) {
    const status =
      err.code === 'FIELDS_REQUIRED' ||
      err.code === 'INVALID_EXPORT_TYPE' ||
      err.code === 'INVALID_SCHEDULE'
        ? 422
        : 422;
    return Response.json({ error: err.message, code: err.code }, { status });
  }
}
