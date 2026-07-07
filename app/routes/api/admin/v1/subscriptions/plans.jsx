// GET /api/admin/v1/subscriptions/plans — list subscription plans
// POST /api/admin/v1/subscriptions/plans — create subscription plan
// Requires admin-scoped API key.

import {
  createSubscriptionPlan,
  listSubscriptionPlans,
  parseCreatePlanInput,
  parsePlanListParams,
  SUBSCRIPTION_INTERVALS,
} from '#/core/subscriptions/index.server';

function planErrorResponse(err) {
  if (err.code === 'NOT_FOUND' || err.code === 'VARIANT_NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'PLAN_NAME_REQUIRED' ||
    err.code === 'INVALID_SUBSCRIPTION_INTERVAL' ||
    err.code === 'INVALID_INTERVAL_COUNT'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parsePlanListParams(url.searchParams);
    const result = await listSubscriptionPlans({
      ...params,
      activeOnly: params.activeOnly ?? false,
    });
    return Response.json({
      ...result,
      subscriptionIntervals: SUBSCRIPTION_INTERVALS,
    });
  } catch (err) {
    return planErrorResponse(err);
  }
}

export async function action({ request }) {
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
    parseCreatePlanInput(body);
    const plan = await createSubscriptionPlan(body);
    return Response.json({ plan }, { status: 201 });
  } catch (err) {
    return planErrorResponse(err);
  }
}
