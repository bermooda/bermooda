// app/routes/admin/reports/export.jsx
// CSV download endpoint for immediate and scheduled exports.

import { authenticate } from '#/libs/auth/admin.server';
import { recordAdminAudit } from '#/core/audit/index.server';
import {
  parseExportDownloadParams,
  resolveExportDownload,
} from '#/core/exports/index.server';

export async function loader({ request }) {
  const { user } = await authenticate(request);
  const url = new URL(request.url);

  try {
    const params = parseExportDownloadParams(url.searchParams);
    const { csv, filename, auditEntityId, auditMetadata } =
      await resolveExportDownload(params);

    await recordAdminAudit({
      user,
      action: 'export.downloaded',
      entityType: 'export',
      entityId: auditEntityId,
      metadata: auditMetadata,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.code === 'INVALID_REQUEST') {
      throw new Response(err.message, { status: err.status ?? 404 });
    }
    throw err;
  }
}

export default function AdminReportsExportRoute() {
  return null;
}
