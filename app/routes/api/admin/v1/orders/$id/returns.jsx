// POST /api/admin/v1/orders/:id/returns — create a return request
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { requestReturn } from '#/core/returns/index.server';

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { reason, lines } = body;
  if (!Array.isArray(lines) || lines.length === 0) {
    return Response.json({ error: 'lines array is required' }, { status: 400 });
  }

  try {
    const returnRecord = await requestReturn(params.id, { reason, lines });
    return Response.json({ return: returnRecord }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
