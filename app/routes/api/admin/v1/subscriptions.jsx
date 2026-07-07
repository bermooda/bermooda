// GET /api/admin/v1/subscriptions — list customer subscriptions
// POST /api/admin/v1/subscriptions — create customer subscription
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  createSubscription,
  listSubscriptions,
  parseCreateSubscriptionInput,
  parseSubscriptionListParams,
  SUBSCRIPTION_STATUSES,
} from '#/core/subscriptions/index.server';

function subscriptionErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'CUSTOMER_ID_REQUIRED' ||
    err.code === 'PLAN_ID_REQUIRED' ||
    err.code === 'INVALID_SUBSCRIPTION_STATUS'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);

  try {
    const params = parseSubscriptionListParams(url.searchParams);
    const result = await listSubscriptions(params);
    return Response.json({
      ...result,
      subscriptionStatuses: SUBSCRIPTION_STATUSES,
    });
  } catch (err) {
    return subscriptionErrorResponse(err);
  }
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    parseCreateSubscriptionInput(body);
    const subscription = await createSubscription(body);
    return Response.json({ subscription }, { status: 201 });
  } catch (err) {
    return subscriptionErrorResponse(err);
  }
}
