// GET /api/admin/v1/subscriptions/:id — get customer subscription
// PATCH /api/admin/v1/subscriptions/:id — cancel subscription
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  cancelSubscription,
  getSubscription,
} from '#/core/subscriptions/index.server';

const mapSubscriptionError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const subscription = await getSubscription(params.id);
    return Response.json({ subscription });
  } catch (err) {
    return mapSubscriptionError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  try {
    const subscription = await cancelSubscription(params.id);
    return Response.json({ subscription });
  } catch (err) {
    return mapSubscriptionError(err);
  }
}
