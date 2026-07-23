// app/core/inventory/locations.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    location: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
    },
    inventoryLevel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '#/libs/prisma.server';
import {
  createLocation,
  listInventoryLevelsForVariants,
  listLocationsWithInventory,
} from '#/core/inventory/locations/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createLocation', () => {
  it('creates an active location with pickup flag', async () => {
    prisma.location.create.mockResolvedValue({ id: 'loc_1' });

    await createLocation({
      name: 'Main warehouse',
      code: 'main',
      allowsPickup: true,
    });

    expect(prisma.location.create).toHaveBeenCalledWith({
      data: {
        name: 'Main warehouse',
        code: 'main',
        active: true,
        allowsPickup: true,
      },
    });
  });
});

describe('listLocationsWithInventory', () => {
  it('loads locations with nested inventory levels', async () => {
    prisma.location.findMany.mockResolvedValue([{ id: 'loc_1' }]);

    const locations = await listLocationsWithInventory();

    expect(locations).toEqual([{ id: 'loc_1' }]);
    expect(prisma.location.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      include: {
        inventoryLevels: {
          include: {
            variant: { select: { id: true, sku: true, productId: true } },
          },
        },
      },
    });
  });
});

describe('listInventoryLevelsForVariants', () => {
  it('returns an empty object when no variant ids are provided', async () => {
    await expect(listInventoryLevelsForVariants([])).resolves.toEqual({});
    expect(prisma.inventoryLevel.findMany).not.toHaveBeenCalled();
  });

  it('backfills missing levels and groups inventory by variant', async () => {
    prisma.location.findFirst.mockResolvedValue({ id: 'loc_default' });
    prisma.inventoryLevel.findUnique.mockResolvedValue({ id: 'lvl_existing' });
    prisma.inventoryLevel.findMany.mockResolvedValue([
      { id: 'lvl_1', variantId: 'var_1', location: { isDefault: true } },
      { id: 'lvl_2', variantId: 'var_2', location: { isDefault: true } },
      { id: 'lvl_3', variantId: 'var_1', location: { isDefault: false } },
    ]);

    const result = await listInventoryLevelsForVariants(['var_1', 'var_2']);

    expect(result).toEqual({
      var_1: [
        { id: 'lvl_1', variantId: 'var_1', location: { isDefault: true } },
        { id: 'lvl_3', variantId: 'var_1', location: { isDefault: false } },
      ],
      var_2: [
        { id: 'lvl_2', variantId: 'var_2', location: { isDefault: true } },
      ],
    });
  });
});
