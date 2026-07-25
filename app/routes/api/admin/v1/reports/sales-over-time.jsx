// GET /api/admin/v1/reports/sales-over-time — daily sales buckets
import {
  getSalesOverTime,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const salesOverTime = await getSalesOverTime(params);
  return Response.json({ salesOverTime });
}
