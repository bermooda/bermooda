// GET /api/admin/v1/audit-logs/:id — get a single audit log entry
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import { getAuditLog } from '#/core/audit/index.server';

const mapAuditLogError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
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
    return mapAuditLogError(err);
  }
}
