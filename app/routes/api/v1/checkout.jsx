// POST /api/v1/checkout — create a checkout session from a cart

import prisma from '#/libs/prisma.server';
import { createCheckoutSession } from '#/core/checkout/index.server';

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { cartToken, customerId, email } = body;
  if (!cartToken) {
    return Response.json({ error: 'cartToken is required' }, { status: 400 });
  }

  const cart = await prisma.cart.findUnique({ where: { token: cartToken } });
  if (!cart) {
    return Response.json({ error: 'Cart not found' }, { status: 404 });
  }

  try {
    const session = await createCheckoutSession(cart.id, { customerId, email });
    return Response.json({ session }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
