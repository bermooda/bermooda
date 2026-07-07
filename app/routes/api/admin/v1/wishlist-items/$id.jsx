// GET /api/admin/v1/wishlist-items/:id — get wishlist item
// DELETE /api/admin/v1/wishlist-items/:id — delete wishlist item
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  requireOneOfMethods,
} from '#/libs/api/admin.server';
import {
  deleteWishlistItem,
  getWishlistItem,
} from '#/core/wishlists/index.server';

const mapWishlistError = createDomainErrorMapper({
  notFound: ['NOT_FOUND'],
});

export async function loader({ params }) {
  try {
    const item = await getWishlistItem(params.id);
    return Response.json({ item });
  } catch (err) {
    return mapWishlistError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireOneOfMethods(request, ['DELETE']);
  if (methodError) return methodError;

  try {
    await deleteWishlistItem(params.id);
    return Response.json({ deleted: true });
  } catch (err) {
    return mapWishlistError(err);
  }
}
