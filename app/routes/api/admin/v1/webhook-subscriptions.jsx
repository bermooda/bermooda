// GET /api/admin/v1/webhook-subscriptions — list subscriptions
// POST /api/admin/v1/webhook-subscriptions — create subscription
// Requires admin-scoped API key.

import { DOMAIN_EVENTS } from '#/core/events/names';
import {
  listSubscriptions,
  createSubscription,
} from '#/core/webhooks/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    100
  );

  const result = await listSubscriptions({ page, limit });
  return Response.json({ ...result, supportedEvents: DOMAIN_EVENTS });
}

export async function action({ request }) {
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
    const status =
      err.code === 'URL_REQUIRED' ||
      err.code === 'SECRET_REQUIRED' ||
      err.code === 'EVENTS_REQUIRED' ||
      err.code === 'EVENTS_INVALID'
        ? 422
        : 422;
    return Response.json({ error: err.message, code: err.code }, { status });
  }
}
