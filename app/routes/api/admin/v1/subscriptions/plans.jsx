// GET /api/admin/v1/subscriptions/plans — list subscription plans
// POST /api/admin/v1/subscriptions/plans — create subscription plan
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  createSubscriptionPlan,
  listSubscriptionPlans,
  parseCreatePlanInput,
  parsePlanListParams,
  SUBSCRIPTION_INTERVALS,
} from '#/core/subscriptions/index.server';

const mapPlanError = createDomainErrorMapper({
  notFound: ['NOT_FOUND', 'VARIANT_NOT_FOUND'],
  badRequest: [
    'PLAN_NAME_REQUIRED',
    'INVALID_SUBSCRIPTION_INTERVAL',
    'INVALID_INTERVAL_COUNT',
  ],
});

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
    return mapPlanError(err);
  }
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    parseCreatePlanInput(body);
    const plan = await createSubscriptionPlan(body);
    return Response.json({ plan }, { status: 201 });
  } catch (err) {
    return mapPlanError(err);
  }
}
