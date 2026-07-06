import { requireApiKey } from '#/libs/auth/api.server';
import {
  createSubscriptionPlan,
  listSubscriptionPlans,
} from '#/core/subscriptions/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);
  const plans = await listSubscriptionPlans({ activeOnly: false });
  return Response.json({ plans });
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const plan = await createSubscriptionPlan(body);
  return Response.json({ plan }, { status: 201 });
}
