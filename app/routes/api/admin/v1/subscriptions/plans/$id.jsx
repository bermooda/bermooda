// GET /api/admin/v1/subscriptions/plans/:id — get subscription plan
// PATCH /api/admin/v1/subscriptions/plans/:id — update subscription plan
// Requires admin-scoped API key.

import {
  getSubscriptionPlan,
  parseUpdatePlanInput,
  updateSubscriptionPlan,
} from '#/core/subscriptions/index.server';

function planErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'PLAN_NAME_REQUIRED' ||
    err.code === 'INVALID_SUBSCRIPTION_INTERVAL' ||
    err.code === 'INVALID_INTERVAL_COUNT' ||
    err.code === 'PLAN_UPDATE_EMPTY'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ params }) {
  try {
    const plan = await getSubscriptionPlan(params.id);
    return Response.json({ plan });
  } catch (err) {
    return planErrorResponse(err);
  }
}

export async function action({ request, params }) {
  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    parseUpdatePlanInput(body);
    const plan = await updateSubscriptionPlan(params.id, body);
    return Response.json({ plan });
  } catch (err) {
    return planErrorResponse(err);
  }
}
