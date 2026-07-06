// GET /api/admin/v1/export-runs/:id — get export run metadata or CSV content
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { getExportRun } from '#/core/exports/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

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
    throw err;
  }
}
