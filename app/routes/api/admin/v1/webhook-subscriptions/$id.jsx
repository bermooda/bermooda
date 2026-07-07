// GET /api/admin/v1/webhook-subscriptions/:id — get subscription + recent deliveries
// PATCH /api/admin/v1/webhook-subscriptions/:id — update subscription
// DELETE /api/admin/v1/webhook-subscriptions/:id — delete subscription
// Requires admin-scoped API key.

import {
  getSubscription,
  deleteSubscription,
  listDeliveries,
  updateSubscription,
} from '#/core/webhooks/index.server';

export async function loader({ params }) {
  try {
    const [subscription, deliveries] = await Promise.all([
      getSubscription(params.id),
      listDeliveries(params.id),
    ]);
    return Response.json({ subscription, deliveries });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return Response.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }
    throw err;
  }
}

export async function action({ request, params }) {
  if (request.method === 'DELETE') {
    try {
      await deleteSubscription(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return Response.json(
          { error: 'Subscription not found' },
          { status: 404 }
        );
      }
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 }
      );
    }
  }

  if (request.method === 'PATCH') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      const subscription = await updateSubscription(params.id, body);
      return Response.json({ subscription });
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return Response.json(
          { error: 'Subscription not found' },
          { status: 404 }
        );
      }
      const status =
        err.code === 'NO_CHANGES' ||
        err.code === 'URL_REQUIRED' ||
        err.code === 'SECRET_REQUIRED' ||
        err.code === 'EVENTS_INVALID'
          ? 422
          : 422;
      return Response.json({ error: err.message, code: err.code }, { status });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
