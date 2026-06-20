// app/core/inventory/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    productVariant: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('#/core/events/index.server', () => ({
  emit: vi.fn(),
}));

vi.mock('#/core/inventory/locations.server', () => ({
  getTotalAvailableQuantity: vi.fn(),
  decrementLocationLevels: vi.fn(),
  incrementLocationLevels: vi.fn(),
}));

import prisma from '#/libs/prisma.server';

import { emit } from '#/core/events/index.server';
import {
  decrementLocationLevels,
  getTotalAvailableQuantity,
  incrementLocationLevels,
} from '#/core/inventory/locations.server';

import {
  checkAvailability,
  decrementInventory,
  getInventoryCount,
  incrementInventory,
} from '#/core/inventory/index.server';

function makeTxClient() {
  return {
    productVariant: {
      findUnique: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
});

describe('decrementInventory', () => {
  it('skips variants with inventoryTracked = false', async () => {
    const txClient = makeTxClient();
    txClient.productVariant.findUnique.mockResolvedValue({
      inventoryTracked: false,
    });

    await decrementInventory(
      [{ variantId: 'v-untracked', quantity: 5 }],
      txClient
    );

    expect(decrementLocationLevels).not.toHaveBeenCalled();
  });

  it('throws INSUFFICIENT_INVENTORY with details when stock is insufficient', async () => {
    const txClient = makeTxClient();
    txClient.productVariant.findUnique.mockResolvedValue({
      inventoryTracked: true,
    });
    getTotalAvailableQuantity.mockResolvedValue(2);

    let caughtErr;
    try {
      await decrementInventory([{ variantId: 'v-low', quantity: 5 }], txClient);
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr.message).toBe('INSUFFICIENT_INVENTORY');
    expect(caughtErr.details).toEqual([
      { variantId: 'v-low', requested: 5, available: 2 },
    ]);
  });

  it('decrements tracked variants when stock is sufficient', async () => {
    const txClient = makeTxClient();
    txClient.productVariant.findUnique.mockResolvedValue({
      inventoryTracked: true,
    });
    getTotalAvailableQuantity.mockResolvedValue(10);

    await decrementInventory([{ variantId: 'v-ok', quantity: 3 }], txClient);

    expect(decrementLocationLevels).toHaveBeenCalledWith(
      txClient,
      'v-ok',
      3
    );
  });
});

describe('incrementInventory', () => {
  it('increments tracked variants and emits restock event', async () => {
    const txClient = makeTxClient();
    txClient.productVariant.findUnique.mockResolvedValue({
      inventoryTracked: true,
    });
    incrementLocationLevels.mockResolvedValue({
      previousTotal: 0,
      newTotal: 4,
    });

    await incrementInventory([{ variantId: 'v-tracked', quantity: 4 }], txClient);

    expect(incrementLocationLevels).toHaveBeenCalledWith(
      txClient,
      'v-tracked',
      4
    );
    expect(emit).toHaveBeenCalledWith('inventory.restocked', {
      variantId: 'v-tracked',
    });
  });

  it('skips untracked variants during increment', async () => {
    const txClient = makeTxClient();
    txClient.productVariant.findUnique.mockResolvedValue({
      inventoryTracked: false,
    });

    await incrementInventory(
      [{ variantId: 'v-untracked', quantity: 10 }],
      txClient
    );

    expect(incrementLocationLevels).not.toHaveBeenCalled();
  });
});

describe('checkAvailability', () => {
  it('returns available true when stock is sufficient', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      inventoryTracked: true,
    });
    getTotalAvailableQuantity.mockResolvedValue(20);

    const result = await checkAvailability([{ variantId: 'v1', quantity: 5 }]);
    expect(result).toEqual({ available: true });
  });

  it('returns insufficient details when stock is low', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      inventoryTracked: true,
    });
    getTotalAvailableQuantity.mockResolvedValue(1);

    const result = await checkAvailability([
      { variantId: 'v-short', quantity: 3 },
    ]);

    expect(result.available).toBe(false);
    expect(result.insufficient).toEqual([
      { variantId: 'v-short', requested: 3, available: 1 },
    ]);
  });
});

describe('getInventoryCount', () => {
  it('delegates to getTotalAvailableQuantity', async () => {
    getTotalAvailableQuantity.mockResolvedValue(42);
    expect(await getInventoryCount('v-exists')).toBe(42);
  });
});
