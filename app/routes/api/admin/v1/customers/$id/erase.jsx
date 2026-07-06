// POST /api/admin/v1/customers/:id/erase — anonymize customer PII
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { eraseCustomer } from '#/core/gdpr/index.server';

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const result = await eraseCustomer(params.id);
    return Response.json(result);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json({ error: err.message }, { status: 404 });
    }
    if (err.code === 'ALREADY_ERASED') {
      return Response.json({ error: err.message, code: err.code }, { status: 409 });
    }
    throw err;
  }
}
