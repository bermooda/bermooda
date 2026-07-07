// GET /api/admin/v1/scheduled-exports — list scheduled exports
// POST /api/admin/v1/scheduled-exports — create scheduled export
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonListResponse,
  parseAdminListPagination,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  EXPORT_SCHEDULES,
  EXPORT_TYPES,
  createScheduledExport,
  listScheduledExports,
} from '#/core/exports/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams, {
    limit: 50,
  });

  const { scheduledExports, total } = await listScheduledExports({
    page,
    limit,
  });
  return jsonListResponse('scheduledExports', {
    items: scheduledExports,
    total,
    page,
    limit,
    extra: {
      exportTypes: EXPORT_TYPES,
      exportSchedules: EXPORT_SCHEDULES,
    },
  });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const scheduledExport = await createScheduledExport(parsed.body);
    return Response.json({ scheduledExport }, { status: 201 });
  } catch (err) {
    return jsonDomainError(err);
  }
}
