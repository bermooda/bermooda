// GET /api/admin/v1/reports/sales-by-product — top products by revenue
import {
  getSalesByProduct,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const salesByProduct = await getSalesByProduct(params);
  return Response.json({ salesByProduct });
}
