// GET /api/admin/v1/reports/inventory — inventory snapshot analytics
import {
  getInventoryMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const currency = url.searchParams.get('currency') || undefined;
  const thresholdRaw = url.searchParams.get('threshold');
  const threshold = thresholdRaw ? Number(thresholdRaw) : undefined;
  const inventory = await getInventoryMetrics({
    ...params,
    currency,
    threshold: Number.isFinite(threshold) ? threshold : undefined,
  });
  return Response.json({ inventory });
}
