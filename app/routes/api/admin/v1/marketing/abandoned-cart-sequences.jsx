// GET /api/admin/v1/marketing/abandoned-cart-sequences — list sequence steps
// POST /api/admin/v1/marketing/abandoned-cart-sequences — create sequence step
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  createAbandonedCartSequence,
  listAbandonedCartSequences,
} from '#/core/marketing/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    100
  );

  const result = await listAbandonedCartSequences({ page, limit });
  return Response.json(result);
}

export async function action({ request }) {
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

  try {
    const sequence = await createAbandonedCartSequence(body);
    return Response.json({ sequence }, { status: 201 });
  } catch (err) {
    if (err.code === 'SEQUENCE_INVALID') {
      return Response.json({ error: err.message, code: err.code }, { status: 422 });
    }
    throw err;
  }
}
