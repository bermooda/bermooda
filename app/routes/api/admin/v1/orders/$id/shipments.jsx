// POST /api/admin/v1/orders/:id/shipments — create a shipment
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { isHookAbort } from '#/core/events/index.server';
import { addShipment } from '#/core/orders/index.server';

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

  try {
    const shipment = await addShipment(params.id, body);
    return Response.json({ shipment }, { status: 201 });
  } catch (err) {
    if (isHookAbort(err)) {
      return Response.json(
        {
          error: err.reason,
          code: err.code,
          blockedBy: err.pluginId,
        },
        { status: 422 }
      );
    }

    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
