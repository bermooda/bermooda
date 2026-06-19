// GET /api/admin/v1/webhook-subscriptions/:id — get subscription + recent deliveries
// DELETE /api/admin/v1/webhook-subscriptions/:id — delete subscription
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';

import {
  getSubscription,
  deleteSubscription,
  listDeliveries,
} from '#/core/webhooks/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

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
  await requireApiKey(request, ['admin']);

  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await deleteSubscription(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
