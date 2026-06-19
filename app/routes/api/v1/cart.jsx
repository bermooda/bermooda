// POST /api/v1/cart — create a cart (public)

import { createCart } from '#/core/cart/index.server';

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // No body or non-JSON — use defaults
  }

  const cart = await createCart({
    currency: body.currency ?? 'USD',
    customerId: body.customerId ?? undefined,
  });

  return Response.json({ cart }, { status: 201 });
}
