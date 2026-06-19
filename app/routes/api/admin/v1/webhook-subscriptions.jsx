// GET /api/admin/v1/webhook-subscriptions — list subscriptions
// POST /api/admin/v1/webhook-subscriptions — create subscription
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';

import {
  listSubscriptions,
  createSubscription,
  WEBHOOK_EVENTS,
} from '#/core/webhooks/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);
  const subscriptions = await listSubscriptions();
  return Response.json({ subscriptions, supportedEvents: WEBHOOK_EVENTS });
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
    const subscription = await createSubscription(body);
    return Response.json({ subscription }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
