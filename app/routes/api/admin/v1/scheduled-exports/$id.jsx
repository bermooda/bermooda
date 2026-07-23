// GET /api/admin/v1/scheduled-exports/:id — get scheduled export
// DELETE /api/admin/v1/scheduled-exports/:id — delete scheduled export
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  deleteScheduledExport,
  getScheduledExport,
} from '#/core/exports/index.server';

const mapScheduledExportError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

function scheduledExportNotFoundResponse() {
  return Response.json(
    { error: 'Scheduled export not found' },
    { status: 404 }
  );
}

export async function loader({ params }) {
  try {
    const scheduledExport = await getScheduledExport(params.id);
    return Response.json({ scheduledExport });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return scheduledExportNotFoundResponse();
    }
    return mapScheduledExportError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'DELETE');
  if (methodError) return methodError;

  try {
    await deleteScheduledExport(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return scheduledExportNotFoundResponse();
    }
    return mapScheduledExportError(err);
  }
}
