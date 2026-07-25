// GET /api/admin/v1/reports/overview — sales overview KPIs
import {
  getOverviewMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const overview = await getOverviewMetrics(params);
  return Response.json({ overview });
}
