// GET /api/admin/v1/orders/:id — get order
// PATCH /api/admin/v1/orders/:id — update order status
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonResourceOr404,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { getOrder, updateOrderStatus } from '#/core/orders/index.server';

export async function loader({ params }) {
  const order = await getOrder(params.id);
  return jsonResourceOr404('order', order, { message: 'Order not found' });
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  const { status } = parsed.body;
  if (!status) {
    return Response.json({ error: 'status is required' }, { status: 400 });
  }

  try {
    const order = await updateOrderStatus(params.id, status);
    return Response.json({ order });
  } catch (err) {
    return jsonDomainError(err);
  }
}
