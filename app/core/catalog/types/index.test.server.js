// app/core/catalog/types.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    productVariant: { findUnique: vi.fn() },
    bundleItem: { findMany: vi.fn() },
  },
}));

import prisma from '#/libs/prisma.server';
import { expandBundleInventoryItems } from '#/core/catalog/types/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('expandBundleInventoryItems', () => {
  it('passes through non-bundle items', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'v1',
      productId: 'p1',
      product: { productType: 'physical' },
    });

    const items = await expandBundleInventoryItems([
      { variantId: 'v1', quantity: 2 },
    ]);

    expect(items).toEqual([{ variantId: 'v1', quantity: 2 }]);
  });

  it('expands bundle into component variants', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'bundle-v',
      productId: 'bundle-p',
      product: { productType: 'bundle' },
    });
    prisma.bundleItem.findMany.mockResolvedValue([
      { componentVariantId: 'comp-a', quantity: 2 },
      { componentVariantId: 'comp-b', quantity: 1 },
    ]);

    const items = await expandBundleInventoryItems([
      { variantId: 'bundle-v', quantity: 3 },
    ]);

    expect(items).toEqual([
      { variantId: 'comp-a', quantity: 6 },
      { variantId: 'comp-b', quantity: 3 },
    ]);
  });
});
