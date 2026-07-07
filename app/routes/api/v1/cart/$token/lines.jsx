// POST /api/v1/cart/:token/lines — add a line to the cart

import {
  cartNotFoundResponse,
  jsonDomainError,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/public.server';
import { addLine, getCart } from '#/core/cart/index.server';

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request);
  if (parsed.error) return parsed.error;

  const { variantId, quantity = 1, locale, currency } = parsed.body;
  if (!variantId) {
    return Response.json({ error: 'variantId is required' }, { status: 400 });
  }

  const cart = await getCart(params.token);
  if (!cart) return cartNotFoundResponse();

  try {
    await addLine(cart.id, variantId, quantity, { locale, currency });
    const updated = await getCart(params.token);
    return Response.json({ cart: updated }, { status: 201 });
  } catch (err) {
    return jsonDomainError(err);
  }
}
