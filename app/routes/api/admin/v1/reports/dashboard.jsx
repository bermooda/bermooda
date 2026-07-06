// GET /api/admin/v1/reports/dashboard — sales analytics dashboard payload
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  getDashboardReport,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const report = await getDashboardReport(params);

  return Response.json({ report });
}
