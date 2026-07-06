// GET /api/admin/v1/customers/:id/data-export — portable JSON export
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { exportCustomerData } from '#/core/gdpr/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const data = await exportCustomerData(params.id);
    return Response.json(data);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
