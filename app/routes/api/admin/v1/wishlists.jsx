// GET /api/admin/v1/wishlists — list customer wishlist items
// POST /api/admin/v1/wishlists — add or remove wishlist item
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { getCustomer } from '#/core/customers/index.server';
import {
  addToWishlist,
  listWishlistItems,
  parseWishlistListParams,
  parseWishlistMutationFromJson,
  removeFromWishlist,
} from '#/core/wishlists/index.server';

const mapWishlistError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
  badRequest: [
    'CUSTOMER_ID_REQUIRED',
    'VARIANT_ID_REQUIRED',
    'INVALID_WISHLIST_ACTION',
  ],
});

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
    return mapWishlistError(err);
  }
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) {
    return Response.json(
      { error: 'Invalid JSON', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  try {
    const { customerId, variantId, intent } = parseWishlistMutationFromJson(
      parsed.body
    );
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
    return mapWishlistError(err);
  }
}
