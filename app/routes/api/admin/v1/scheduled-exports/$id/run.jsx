// POST /api/admin/v1/scheduled-exports/:id/run — queue export run
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  getScheduledExport,
  queueScheduledExport,
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

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  try {
    await getScheduledExport(params.id);
    queueScheduledExport({ scheduledExportId: params.id });
    return Response.json({ queued: true }, { status: 202 });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return scheduledExportNotFoundResponse();
    }
    return mapScheduledExportError(err);
  }
}
