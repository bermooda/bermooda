// GET/DELETE /api/v1/cart/:token

import {
  cartNotFoundResponse,
  requireMethod,
} from '#/libs/api/public/index.server';
import { deleteCart, getCart } from '#/core/cart/index.server';

export async function loader({ params }) {
  const cart = await getCart(params.token);
  if (!cart) return cartNotFoundResponse();
  return Response.json({ cart });
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'DELETE');
  if (methodError) return methodError;

  const deleted = await deleteCart(params.token);
  if (!deleted) return cartNotFoundResponse();

  return Response.json({ deleted: true });
}
