// app/core/wishlists/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    wishlist: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    wishlistItem: {
      upsert: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import {
  addToWishlist,
  getOrCreateDefaultWishlist,
  removeFromWishlist,
} from '#/core/wishlists/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('wishlists', () => {
  it('getOrCreateDefaultWishlist returns existing list', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({ id: 'w1' });
    const list = await getOrCreateDefaultWishlist('cust-1');
    expect(list.id).toBe('w1');
    expect(prisma.wishlist.create).not.toHaveBeenCalled();
  });

  it('getOrCreateDefaultWishlist creates default list', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(null);
    prisma.wishlist.create.mockResolvedValue({ id: 'w-new' });

    const list = await getOrCreateDefaultWishlist('cust-1');
    expect(list.id).toBe('w-new');
  });

  it('addToWishlist upserts item', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.upsert.mockResolvedValue({ id: 'wi1' });

    await addToWishlist('cust-1', 'v1');
    expect(prisma.wishlistItem.upsert).toHaveBeenCalled();
  });

  it('removeFromWishlist deletes item', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({ id: 'w1' });
    prisma.wishlistItem.delete.mockResolvedValue({ id: 'wi1' });

    await removeFromWishlist('cust-1', 'v1');
    expect(prisma.wishlistItem.delete).toHaveBeenCalled();
  });
});
