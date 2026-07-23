// app/core/inventory/tracking.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    productVariant: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import { filterTrackedInventoryItems } from '#/core/inventory/tracking/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('filterTrackedInventoryItems', () => {
  it('returns only tracked variants', async () => {
    prisma.productVariant.findMany.mockResolvedValue([
      { id: 'v-tracked', inventoryTracked: true },
      { id: 'v-untracked', inventoryTracked: false },
    ]);

    const result = await filterTrackedInventoryItems(prisma, [
      { variantId: 'v-tracked', quantity: 2 },
      { variantId: 'v-untracked', quantity: 1 },
      { variantId: 'v-missing', quantity: 3 },
    ]);

    expect(result).toEqual([{ variantId: 'v-tracked', quantity: 2 }]);
  });

  it('returns an empty array when no items are provided', async () => {
    const result = await filterTrackedInventoryItems(prisma, []);
    expect(result).toEqual([]);
    expect(prisma.productVariant.findMany).not.toHaveBeenCalled();
  });
});
