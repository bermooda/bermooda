// GET /api/admin/v1/subscriptions/plans/:id — get subscription plan
// PATCH /api/admin/v1/subscriptions/plans/:id — update subscription plan
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  getSubscriptionPlan,
  parseUpdatePlanInput,
  updateSubscriptionPlan,
} from '#/core/subscriptions/index.server';

const mapPlanError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: [
    'PLAN_NAME_REQUIRED',
    'INVALID_SUBSCRIPTION_INTERVAL',
    'INVALID_INTERVAL_COUNT',
    'PLAN_UPDATE_EMPTY',
  ],
});

export async function loader({ params }) {
  try {
    const plan = await getSubscriptionPlan(params.id);
    return Response.json({ plan });
  } catch (err) {
    return mapPlanError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  try {
    parseUpdatePlanInput(body);
    const plan = await updateSubscriptionPlan(params.id, body);
    return Response.json({ plan });
  } catch (err) {
    return mapPlanError(err);
  }
}
