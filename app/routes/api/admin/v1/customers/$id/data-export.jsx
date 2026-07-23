// GET /api/admin/v1/customers/:id/data-export — portable JSON export
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin/index.server';
import { exportCustomerData } from '#/core/gdpr/index.server';

const mapDataExportError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const data = await exportCustomerData(params.id);
    return Response.json(data);
  } catch (err) {
    return mapDataExportError(err);
  }
}
