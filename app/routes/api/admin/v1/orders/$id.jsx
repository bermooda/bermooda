// GET /api/admin/v1/orders/:id — get order
// PATCH /api/admin/v1/orders/:id — update order status
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import { getOrder, updateOrderStatus } from '#/core/orders/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const order = await getOrder(params.id);
    return Response.json({ order });
  } catch {
    return Response.json({ error: 'Order not found' }, { status: 404 });
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

  const { status } = body;
  if (!status) {
    return Response.json({ error: 'status is required' }, { status: 400 });
  }

  try {
    const order = await updateOrderStatus(params.id, status);
    return Response.json({ order });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
