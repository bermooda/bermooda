// PATCH/DELETE /api/v1/cart/:token/lines/:lineId

import {
  cartNotFoundResponse,
  methodNotAllowedResponse,
  parseJsonBody,
} from '#/libs/api/public.server';
import { getCart, removeLine, updateQuantity } from '#/core/cart/index.server';

export async function action({ request, params }) {
  const cart = await getCart(params.token);
  if (!cart) return cartNotFoundResponse();

  if (request.method === 'DELETE') {
    await removeLine(cart.id, params.lineId);
    const updated = await getCart(params.token);
    return Response.json({ cart: updated });
  }

  if (request.method === 'PATCH') {
    const parsed = await parseJsonBody(request);
    if (parsed.error) return parsed.error;

    const { quantity } = parsed.body;
    if (typeof quantity !== 'number') {
      return Response.json(
        { error: 'quantity must be a number' },
        { status: 400 }
      );
    }

    await updateQuantity(cart.id, params.lineId, quantity);
    const updated = await getCart(params.token);
    return Response.json({ cart: updated });
  }

  return methodNotAllowedResponse();
}
