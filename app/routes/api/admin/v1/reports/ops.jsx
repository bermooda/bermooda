// GET /api/admin/v1/reports/ops — abandoned checkouts, recent orders, low stock
import {
  getOpsMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const ops = await getOpsMetrics(params);
  return Response.json({ ops });
}
