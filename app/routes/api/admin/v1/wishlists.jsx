// GET /api/admin/v1/wishlists — list customer wishlist items
// POST /api/admin/v1/wishlists — add or remove wishlist item
// Requires admin-scoped API key.

import { getCustomer } from '#/core/customers/index.server';
import {
  addToWishlist,
  listWishlistItems,
  parseWishlistListParams,
  parseWishlistMutationFromJson,
  removeFromWishlist,
} from '#/core/wishlists/index.server';

function wishlistErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  if (
    err.code === 'CUSTOMER_ID_REQUIRED' ||
    err.code === 'VARIANT_ID_REQUIRED' ||
    err.code === 'INVALID_WISHLIST_ACTION'
  ) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 400 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ request }) {
  const url = new URL(request.url);

  try {
    const params = parseWishlistListParams(url.searchParams);
    const customer = await getCustomer(params.customerId);
    if (!customer) {
      return Response.json(
        { error: 'Customer not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const result = await listWishlistItems(params);
    return Response.json(result);
  } catch (err) {
    return wishlistErrorResponse(err);
  }
}

export async function action({ request }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  try {
    const { customerId, variantId, intent } =
      parseWishlistMutationFromJson(body);
    const customer = await getCustomer(customerId);
    if (!customer) {
      return Response.json(
        { error: 'Customer not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (intent === 'remove') {
      await removeFromWishlist(customerId, variantId);
    } else {
      await addToWishlist(customerId, variantId, { validateCustomer: false });
    }

    const result = await listWishlistItems({ customerId });
    return Response.json(result);
  } catch (err) {
    return wishlistErrorResponse(err);
  }
}
