// GET /api/admin/v1/reports/sales-by-category — revenue by category
import {
  getSalesByCategory,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const salesByCategory = await getSalesByCategory(params);
  return Response.json({ salesByCategory });
}
