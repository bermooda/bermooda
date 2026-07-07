// GET /api/admin/v1/wishlist-items/:id — get wishlist item
// DELETE /api/admin/v1/wishlist-items/:id — delete wishlist item
// Requires admin-scoped API key.

import {
  deleteWishlistItem,
  getWishlistItem,
} from '#/core/wishlists/index.server';

function wishlistErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  return Response.json({ error: err.message, code: err.code }, { status: 422 });
}

export async function loader({ params }) {
  try {
    const item = await getWishlistItem(params.id);
    return Response.json({ item });
  } catch (err) {
    return wishlistErrorResponse(err);
  }
}

export async function action({ request, params }) {
  if (request.method === 'DELETE') {
    try {
      await deleteWishlistItem(params.id);
      return Response.json({ deleted: true });
    } catch (err) {
      return wishlistErrorResponse(err);
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
