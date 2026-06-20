// app/core/wishlists/index.server.js
// Customer wishlists.

import prisma from '#/libs/prisma.server';

export async function getOrCreateDefaultWishlist(customerId) {
  const existing = await prisma.wishlist.findFirst({
    where: { customerId, isDefault: true },
  });
  if (existing) return existing;

  return prisma.wishlist.create({
    data: {
      customerId,
      name: 'Default',
      isDefault: true,
    },
  });
}

export async function listWishlistItems(customerId) {
  const wishlist = await getOrCreateDefaultWishlist(customerId);
  return prisma.wishlistItem.findMany({
    where: { wishlistId: wishlist.id },
    include: {
      variant: {
        include: {
          prices: true,
          product: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addToWishlist(customerId, variantId) {
  const wishlist = await getOrCreateDefaultWishlist(customerId);
  return prisma.wishlistItem.upsert({
    where: {
      wishlistId_variantId: { wishlistId: wishlist.id, variantId },
    },
    create: { wishlistId: wishlist.id, variantId },
    update: {},
  });
}

export async function removeFromWishlist(customerId, variantId) {
  const wishlist = await getOrCreateDefaultWishlist(customerId);
  return prisma.wishlistItem.delete({
    where: {
      wishlistId_variantId: { wishlistId: wishlist.id, variantId },
    },
  });
}

export async function isInWishlist(customerId, variantId) {
  const wishlist = await prisma.wishlist.findFirst({
    where: { customerId, isDefault: true },
    select: { id: true },
  });
  if (!wishlist) return false;

  const item = await prisma.wishlistItem.findUnique({
    where: {
      wishlistId_variantId: { wishlistId: wishlist.id, variantId },
    },
  });
  return Boolean(item);
}
