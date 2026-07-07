// GET /api/admin/v1/audit-logs/:id — get a single audit log entry
// Requires admin-scoped API key.

import { getAuditLog } from '#/core/audit/index.server';

export async function loader({ request, params }) {
  try {
    const auditLog = await getAuditLog(params.id);
    return Response.json({ auditLog });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json(
        { error: 'Audit log entry not found' },
        { status: 404 }
      );
    }
    throw err;
  }
}
