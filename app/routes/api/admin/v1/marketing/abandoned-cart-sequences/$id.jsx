// GET /api/admin/v1/marketing/abandoned-cart-sequences/:id — get sequence step
// PATCH /api/admin/v1/marketing/abandoned-cart-sequences/:id — update sequence step
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  getAbandonedCartSequence,
  updateAbandonedCartSequence,
} from '#/core/marketing/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const sequence = await getAbandonedCartSequence(params.id);
    return Response.json({ sequence });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json(
        { error: 'Abandoned cart sequence not found' },
        { status: 404 }
      );
    }
    throw err;
  }
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const sequence = await updateAbandonedCartSequence(params.id, body);
    return Response.json({ sequence });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json(
        { error: 'Abandoned cart sequence not found' },
        { status: 404 }
      );
    }
    if (err.code === 'SEQUENCE_INVALID' || err.code === 'NO_CHANGES') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
    throw err;
  }
}
