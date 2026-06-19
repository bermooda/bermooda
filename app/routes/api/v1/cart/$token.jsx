// GET/DELETE /api/v1/cart/:token

import prisma from '#/libs/prisma.server';

export async function loader({ params }) {
  const cart = await prisma.cart.findUnique({
    where: { token: params.token },
    include: { lines: { include: { variant: true } } },
  });
  if (!cart) return Response.json({ error: 'Cart not found' }, { status: 404 });
  return Response.json({ cart });
}

export async function action({ request, params }) {
  if (request.method !== 'DELETE') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const cart = await prisma.cart.findUnique({ where: { token: params.token } });
  if (!cart) return Response.json({ error: 'Cart not found' }, { status: 404 });

  await prisma.cart.delete({ where: { id: cart.id } });
  return Response.json({ deleted: true });
}
