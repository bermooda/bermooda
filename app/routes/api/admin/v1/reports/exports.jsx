// GET /api/admin/v1/reports/exports — scheduled export health metrics
import {
  getExportMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const exports = await getExportMetrics(params);
  return Response.json({ exports });
}
