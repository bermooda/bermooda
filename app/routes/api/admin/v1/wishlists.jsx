import { requireApiKey } from '#/libs/auth/api.server';

import {
  addToWishlist,
  listWishlistItems,
  removeFromWishlist,
} from '#/core/wishlists/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const url = new URL(request.url);
  const customerId = url.searchParams.get('customerId');
  if (!customerId) {
    return Response.json({ error: 'customerId required' }, { status: 400 });
  }

  const items = await listWishlistItems(customerId);
  return Response.json({ items });
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { customerId, variantId, intent } = body;
  if (!customerId || !variantId) {
    return Response.json(
      { error: 'customerId and variantId required' },
      { status: 400 }
    );
  }

  if (intent === 'remove') {
    await removeFromWishlist(customerId, variantId);
  } else {
    await addToWishlist(customerId, variantId);
  }

  const items = await listWishlistItems(customerId);
  return Response.json({ items });
}
