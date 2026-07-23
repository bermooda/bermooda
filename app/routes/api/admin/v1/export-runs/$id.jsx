// GET /api/admin/v1/export-runs/:id — get export run metadata or CSV content
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin/index.server';
import { getExportRun } from '#/core/exports/index.server';

const mapExportRunError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ request, params }) {
  const url = new URL(request.url);
  const includeContent =
    url.searchParams.get('includeContent') === 'true' ||
    url.searchParams.get('includeContent') === '1';

  try {
    const exportRun = await getExportRun(params.id, {
      includeFileContent: includeContent,
    });
    return Response.json({ exportRun });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: 'Export run not found' }, { status: 404 });
    }
    return mapExportRunError(err);
  }
}
