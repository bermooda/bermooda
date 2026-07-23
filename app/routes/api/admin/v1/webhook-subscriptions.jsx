// GET /api/admin/v1/webhook-subscriptions — list subscriptions
// POST /api/admin/v1/webhook-subscriptions — create subscription
// Requires admin-scoped API key.

import {
  jsonDomainError,
  jsonListResponse,
  parseAdminListPagination,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { DOMAIN_EVENTS } from '#/core/events/names/index';
import {
  listSubscriptions,
  createSubscription,
} from '#/core/webhooks/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams, {
    limit: 50,
  });

  const { subscriptions, total } = await listSubscriptions({ page, limit });
  return jsonListResponse('subscriptions', {
    items: subscriptions,
    total,
    page,
    limit,
    extra: { supportedEvents: DOMAIN_EVENTS },
  });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  try {
    const subscription = await createSubscription(parsed.body);
    return Response.json({ subscription }, { status: 201 });
  } catch (err) {
    return jsonDomainError(err);
  }
}
