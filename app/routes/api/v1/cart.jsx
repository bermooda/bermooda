// POST /api/v1/cart — create a cart (public)

import { parseJsonBody, requireMethod } from '#/libs/api/public/index.server';
import { createCart } from '#/core/cart/index.server';

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, { defaultValue: {} });
  if (parsed.error) return parsed.error;

  const cart = await createCart({
    currency: parsed.body.currency ?? 'USD',
    customerId: parsed.body.customerId ?? undefined,
  });

  return Response.json({ cart }, { status: 201 });
}
