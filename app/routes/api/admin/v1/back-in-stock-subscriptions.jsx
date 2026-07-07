// GET /api/admin/v1/back-in-stock-subscriptions — list subscriptions
// Requires admin-scoped API key.

import {
  listBackInStockSubscriptions,
  parseSubscriptionListParams,
  SUBSCRIPTION_STATUSES,
} from '#/core/back-in-stock/index.server';

function subscriptionErrorResponse(err) {
  if (err.code === 'INVALID_SUBSCRIPTION_STATUS') {
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
    const params = parseSubscriptionListParams(url.searchParams);
    const result = await listBackInStockSubscriptions(params);
    return Response.json({
      ...result,
      subscriptionStatuses: SUBSCRIPTION_STATUSES,
    });
  } catch (err) {
    return subscriptionErrorResponse(err);
  }
}
