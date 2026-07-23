// POST /api/v1/checkout — create a checkout session from a cart

import {
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/public/index.server';
import { createCheckoutSessionFromCartToken } from '#/core/checkout/index.server';

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  const { cartToken, customerId, email } = parsed.body;
  if (!cartToken) {
    return Response.json({ error: 'cartToken is required' }, { status: 400 });
  }

  try {
    const session = await createCheckoutSessionFromCartToken(cartToken, {
      customerId,
      email,
    });
    return Response.json({ session }, { status: 201 });
  } catch (err) {
    return jsonDomainError(err);
  }
}
