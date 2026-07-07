// GET /api/admin/v1/subscriptions/:id — get customer subscription
// PATCH /api/admin/v1/subscriptions/:id — cancel subscription
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  cancelSubscription,
  getSubscription,
} from '#/core/subscriptions/index.server';

function subscriptionErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const subscription = await getSubscription(params.id);
    return Response.json({ subscription });
  } catch (err) {
    return subscriptionErrorResponse(err);
  }
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const subscription = await cancelSubscription(params.id);
    return Response.json({ subscription });
  } catch (err) {
    return subscriptionErrorResponse(err);
  }
}
