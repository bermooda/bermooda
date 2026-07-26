// GET /api/admin/v1/reports/customers — customer analytics
import {
  getCustomerMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const customers = await getCustomerMetrics(params);
  return Response.json({ customers });
}
