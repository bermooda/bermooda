// POST /api/admin/v1/orders/:id/shipments — create a shipment
// Requires admin-scoped API key.

import {
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { jsonActionError } from '#/core/events/http.server';
import { addShipment } from '#/core/orders/index.server';

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const shipment = await addShipment(params.id, parsed.body);
    return Response.json({ shipment }, { status: 201 });
  } catch (err) {
    return jsonActionError(err, jsonDomainError);
  }
}
