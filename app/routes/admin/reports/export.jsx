// app/routes/admin/reports/export.jsx
// CSV download endpoint for immediate and scheduled exports.

import { authenticate } from '#/libs/auth/admin.server';

import { recordAdminAudit } from '#/core/audit/index.server';
import { generateExport, getExportRun } from '#/core/exports/index.server';

export async function loader({ request }) {
  const { user } = await authenticate(request);
  const url = new URL(request.url);
  const runId = url.searchParams.get('runId');
  const type = url.searchParams.get('type');
  const startDate = url.searchParams.get('startDate') ?? undefined;
  const endDate = url.searchParams.get('endDate') ?? undefined;

  let csv;
  let filename;
  let rowCount = 0;

  if (runId) {
    const run = await getExportRun(runId);
    if (!run || run.status !== 'completed' || !run.fileContent) {
      throw new Response('Export not found', { status: 404 });
    }
    csv = run.fileContent;
    filename = `${run.exportType}-export-${run.id}.csv`;
    rowCount = run.rowCount;
  } else if (type) {
    const result = await generateExport(type, { startDate, endDate });
    csv = result.csv;
    rowCount = result.rowCount;
    filename = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
  } else {
    throw new Response('Missing export type or run id', { status: 400 });
  }

  await recordAdminAudit({
    user,
    action: 'export.downloaded',
    entityType: 'export',
    entityId: runId ?? type,
    metadata: { type: type ?? runId, rowCount },
  });

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export default function AdminReportsExportRoute() {
  return null;
}
