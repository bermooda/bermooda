// GET /api/admin/v1/back-in-stock-subscriptions/:id — get subscription
// DELETE /api/admin/v1/back-in-stock-subscriptions/:id — delete subscription
// Requires admin-scoped API key.

import {
  deleteBackInStockSubscription,
  getBackInStockSubscription,
} from '#/core/back-in-stock/index.server';

function subscriptionErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ params }) {
  try {
    const subscription = await getBackInStockSubscription(params.id);
    return Response.json({ subscription });
  } catch (err) {
    return subscriptionErrorResponse(err);
  }
}

export async function action({ request, params }) {
  if (request.method === 'DELETE') {
    try {
      await deleteBackInStockSubscription(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return subscriptionErrorResponse(err);
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
