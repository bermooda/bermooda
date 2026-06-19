// PATCH/DELETE /api/v1/cart/:token/lines/:lineId

import prisma from '#/libs/prisma.server';

import { removeLine, updateQuantity } from '#/core/cart/index.server';

export async function action({ request, params }) {
  const cart = await prisma.cart.findUnique({ where: { token: params.token } });
  if (!cart) return Response.json({ error: 'Cart not found' }, { status: 404 });

  if (request.method === 'DELETE') {
    await removeLine(cart.id, params.lineId);
    const updated = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { lines: { include: { variant: true } } },
    });
    return Response.json({ cart: updated });
  }

  if (request.method === 'PATCH') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { quantity } = body;
    if (typeof quantity !== 'number') {
      return Response.json(
        { error: 'quantity must be a number' },
        { status: 400 }
      );
    }

    await updateQuantity(cart.id, params.lineId, quantity);
    const updated = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: { lines: { include: { variant: true } } },
    });
    return Response.json({ cart: updated });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
