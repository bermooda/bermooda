// app/core/inventory/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
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

vi.mock('#/core/inventory/tracking.server', () => ({
  filterTrackedInventoryItems: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { emit } from '#/core/events/index.server';
import {
  decrementInventory,
  incrementInventory,
} from '#/core/inventory/index.server';
import {
  decrementLocationLevels,
  getTotalAvailableQuantity,
  incrementLocationLevels,
} from '#/core/inventory/locations.server';
import { filterTrackedInventoryItems } from '#/core/inventory/tracking.server';

const txClient = {};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation((fn) => fn(txClient));
});

describe('decrementInventory', () => {
  it('skips when no tracked variants are returned', async () => {
    filterTrackedInventoryItems.mockResolvedValue([]);

    await decrementInventory(
      [{ variantId: 'v-untracked', quantity: 5 }],
      txClient
    );

    expect(decrementLocationLevels).not.toHaveBeenCalled();
  });

  it('throws INSUFFICIENT_INVENTORY with details when stock is insufficient', async () => {
    filterTrackedInventoryItems.mockResolvedValue([
      { variantId: 'v-low', quantity: 5 },
    ]);
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
    filterTrackedInventoryItems.mockResolvedValue([
      { variantId: 'v-ok', quantity: 3 },
    ]);
    getTotalAvailableQuantity.mockResolvedValue(10);

    await decrementInventory([{ variantId: 'v-ok', quantity: 3 }], txClient);

    expect(decrementLocationLevels).toHaveBeenCalledWith(txClient, 'v-ok', 3);
  });
});

describe('incrementInventory', () => {
  it('increments tracked variants and emits restock event', async () => {
    filterTrackedInventoryItems.mockResolvedValue([
      { variantId: 'v-tracked', quantity: 4 },
    ]);
    incrementLocationLevels.mockResolvedValue({
      previousTotal: 0,
      newTotal: 4,
    });

    await incrementInventory(
      [{ variantId: 'v-tracked', quantity: 4 }],
      txClient
    );

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
    filterTrackedInventoryItems.mockResolvedValue([]);

    await incrementInventory(
      [{ variantId: 'v-untracked', quantity: 10 }],
      txClient
    );

    expect(incrementLocationLevels).not.toHaveBeenCalled();
  });
});
