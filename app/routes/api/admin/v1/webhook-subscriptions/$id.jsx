// GET /api/admin/v1/webhook-subscriptions/:id — get subscription + recent deliveries
// PATCH /api/admin/v1/webhook-subscriptions/:id — update subscription
// DELETE /api/admin/v1/webhook-subscriptions/:id — delete subscription
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  jsonDomainError,
  parseJsonBody,
  requireOneOfMethods,
} from '#/libs/api/admin/index.server';
import {
  getSubscription,
  deleteSubscription,
  listDeliveries,
  updateSubscription,
} from '#/core/webhooks/index.server';

const mapWebhookSubscriptionError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

function subscriptionNotFoundResponse() {
  return Response.json({ error: 'Subscription not found' }, { status: 404 });
}

export async function loader({ params }) {
  try {
    const [subscription, deliveries] = await Promise.all([
      getSubscription(params.id),
      listDeliveries(params.id),
    ]);
    return Response.json({ subscription, deliveries });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return subscriptionNotFoundResponse();
    }
    throw err;
  }
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['PATCH', 'DELETE']);
  if (methodError) return methodError;

  if (request.method === 'DELETE') {
    try {
      await deleteSubscription(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return subscriptionNotFoundResponse();
      }
      return jsonDomainError(err);
    }
  }

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const subscription = await updateSubscription(params.id, parsed.body);
    return Response.json({ subscription });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return subscriptionNotFoundResponse();
    }
    return mapWebhookSubscriptionError(err);
  }
}
