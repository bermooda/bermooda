// GET /api/admin/v1/subscriptions — list customer subscriptions
// POST /api/admin/v1/subscriptions — create customer subscription
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  createSubscription,
  listSubscriptions,
  parseCreateSubscriptionInput,
  parseSubscriptionListParams,
  SUBSCRIPTION_STATUSES,
} from '#/core/subscriptions/index.server';

const mapSubscriptionError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: [
    'CUSTOMER_ID_REQUIRED',
    'PLAN_ID_REQUIRED',
    'INVALID_SUBSCRIPTION_STATUS',
  ],
});

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parseSubscriptionListParams(url.searchParams);
    const result = await listSubscriptions(params);
    return Response.json({
      ...result,
      subscriptionStatuses: SUBSCRIPTION_STATUSES,
    });
  } catch (err) {
    return mapSubscriptionError(err);
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
    parseCreateSubscriptionInput(body);
    const subscription = await createSubscription(body);
    return Response.json({ subscription }, { status: 201 });
  } catch (err) {
    return mapSubscriptionError(err);
  }
}
