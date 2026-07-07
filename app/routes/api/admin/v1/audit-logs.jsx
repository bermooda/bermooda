// GET /api/admin/v1/audit-logs — list audit log entries
// Requires admin-scoped API key.

import { listAuditLogs, parseAuditListParams } from '#/core/audit/index.server';
import { DOMAIN_EVENTS } from '#/core/events/names';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseAuditListParams(url.searchParams);
  const result = await listAuditLogs(params);

  return Response.json({ ...result, supportedEvents: DOMAIN_EVENTS });
}
