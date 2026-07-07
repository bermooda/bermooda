// GET /api/admin/v1/back-in-stock-subscriptions — list subscriptions
// Requires admin-scoped API key.

import { createDomainErrorMapper } from '#/libs/api/admin.server';
import {
  listBackInStockSubscriptions,
  parseSubscriptionListParams,
  SUBSCRIPTION_STATUSES,
} from '#/core/back-in-stock/index.server';

const mapSubscriptionError = createDomainErrorMapper({
  badRequest: ['INVALID_SUBSCRIPTION_STATUS'],
});

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
    return mapSubscriptionError(err);
  }
}
