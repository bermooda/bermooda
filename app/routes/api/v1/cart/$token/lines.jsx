// POST /api/v1/cart/:token/lines — add a line to the cart

import prisma from '#/libs/prisma.server';
import { addLine } from '#/core/cart/index.server';

export async function action({ request, params }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { variantId, quantity = 1, locale, currency } = body;
  if (!variantId)
    return Response.json({ error: 'variantId is required' }, { status: 400 });

  const cart = await prisma.cart.findUnique({ where: { token: params.token } });
  if (!cart) return Response.json({ error: 'Cart not found' }, { status: 404 });

  try {
    await addLine(cart.id, variantId, quantity, { locale, currency });
    const updated = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { lines: { include: { variant: true } } },
    });
    return Response.json({ cart: updated }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 }
    );
  }
}
