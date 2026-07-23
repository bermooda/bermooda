// GET /api/admin/v1/back-in-stock-subscriptions/:id — get subscription
// DELETE /api/admin/v1/back-in-stock-subscriptions/:id — delete subscription
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireOneOfMethods,
} from '#/libs/api/admin/index.server';
import {
  deleteBackInStockSubscription,
  getBackInStockSubscription,
} from '#/core/back-in-stock/index.server';

const mapSubscriptionError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const subscription = await getBackInStockSubscription(params.id);
    return Response.json({ subscription });
  } catch (err) {
    return mapSubscriptionError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['DELETE']);
  if (methodError) return methodError;

  try {
    await deleteBackInStockSubscription(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    return mapSubscriptionError(err);
  }
}
