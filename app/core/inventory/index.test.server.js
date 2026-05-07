// app/core/inventory/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock #/libs/prisma.server
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => ({
  default: {
    productVariant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '#/libs/prisma.server';

import {
  checkAvailability,
  decrementInventory,
  getInventoryCount,
  incrementInventory,
} from './index.server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a mock Prisma transaction client that uses its own spy functions.
 * Accepts a map of variantId -> variant data to return from findUnique.
 */
function makeTxClient(variantMap = {}) {
  return {
    productVariant: {
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(variantMap[where.id] ?? null)
      ),
      update: vi.fn(() => Promise.resolve({})),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default $transaction implementation: invoke the callback with a tx client
  // derived from the mock productVariant methods on prisma itself.
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
});

// ---------------------------------------------------------------------------
// decrementInventory
// ---------------------------------------------------------------------------

describe('decrementInventory', () => {
  it('skips variants with inventoryTracked = false', async () => {
    const txClient = makeTxClient({
      'v-untracked': {
        id: 'v-untracked',
        inventoryCount: 0,
        inventoryTracked: false,
      },
    });

    await decrementInventory(
      [{ variantId: 'v-untracked', quantity: 5 }],
      txClient
    );

    // update should never be called for an untracked variant
    expect(txClient.productVariant.update).not.toHaveBeenCalled();
  });

  it('throws INSUFFICIENT_INVENTORY with details when stock is insufficient', async () => {
    const txClient = makeTxClient({
      'v-low': { id: 'v-low', inventoryCount: 2, inventoryTracked: true },
    });

    let caughtErr;
    try {
      await decrementInventory([{ variantId: 'v-low', quantity: 5 }], txClient);
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr).toBeDefined();
    expect(caughtErr.message).toBe('INSUFFICIENT_INVENTORY');
    expect(caughtErr.details).toEqual([
      { variantId: 'v-low', requested: 5, available: 2 },
    ]);
  });

  it('collects multiple insufficient items into details array', async () => {
    const txClient = makeTxClient({
      'v-a': { id: 'v-a', inventoryCount: 1, inventoryTracked: true },
      'v-b': { id: 'v-b', inventoryCount: 0, inventoryTracked: true },
    });

    let caughtErr;
    try {
      await decrementInventory(
        [
          { variantId: 'v-a', quantity: 3 },
          { variantId: 'v-b', quantity: 2 },
        ],
        txClient
      );
    } catch (err) {
      caughtErr = err;
    }

    expect(caughtErr.message).toBe('INSUFFICIENT_INVENTORY');
    expect(caughtErr.details).toHaveLength(2);
    expect(caughtErr.details).toEqual(
      expect.arrayContaining([
        { variantId: 'v-a', requested: 3, available: 1 },
        { variantId: 'v-b', requested: 2, available: 0 },
      ])
    );
  });

  it('decrements tracked variants when stock is sufficient', async () => {
    const txClient = makeTxClient({
      'v-ok': { id: 'v-ok', inventoryCount: 10, inventoryTracked: true },
    });

    await decrementInventory([{ variantId: 'v-ok', quantity: 3 }], txClient);

    expect(txClient.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v-ok' },
      data: { inventoryCount: { decrement: 3 } },
    });
  });

  it('uses prisma.$transaction when no tx is provided', async () => {
    // $transaction is already mocked; verify it is called
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'v-ok',
      inventoryCount: 10,
      inventoryTracked: true,
    });
    prisma.productVariant.update.mockResolvedValue({});

    await decrementInventory([{ variantId: 'v-ok', quantity: 2 }]);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// incrementInventory
// ---------------------------------------------------------------------------

describe('incrementInventory', () => {
  it('increments tracked variants', async () => {
    const txClient = makeTxClient({
      'v-tracked': { id: 'v-tracked', inventoryTracked: true },
    });

    await incrementInventory(
      [{ variantId: 'v-tracked', quantity: 4 }],
      txClient
    );

    expect(txClient.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v-tracked' },
      data: { inventoryCount: { increment: 4 } },
    });
  });

  it('skips untracked variants during increment', async () => {
    const txClient = makeTxClient({
      'v-untracked': { id: 'v-untracked', inventoryTracked: false },
    });

    await incrementInventory(
      [{ variantId: 'v-untracked', quantity: 10 }],
      txClient
    );

    expect(txClient.productVariant.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// checkAvailability
// ---------------------------------------------------------------------------

describe('checkAvailability', () => {
  it('returns { available: true } when all items have sufficient stock', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      inventoryCount: 20,
      inventoryTracked: true,
    });

    const result = await checkAvailability([{ variantId: 'v1', quantity: 5 }]);

    expect(result).toEqual({ available: true });
  });

  it('returns { available: false, insufficient: [...] } when stock is insufficient', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      inventoryCount: 1,
      inventoryTracked: true,
    });

    const result = await checkAvailability([
      { variantId: 'v-short', quantity: 3 },
    ]);

    expect(result.available).toBe(false);
    expect(result.insufficient).toEqual([
      { variantId: 'v-short', requested: 3, available: 1 },
    ]);
  });

  it('treats untracked variants as always available in checkAvailability', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      inventoryCount: 0,
      inventoryTracked: false,
    });

    const result = await checkAvailability([
      { variantId: 'v-free', quantity: 999 },
    ]);

    expect(result).toEqual({ available: true });
  });
});

// ---------------------------------------------------------------------------
// getInventoryCount
// ---------------------------------------------------------------------------

describe('getInventoryCount', () => {
  it('returns the inventoryCount for a found variant', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({ inventoryCount: 42 });

    const count = await getInventoryCount('v-exists');

    expect(count).toBe(42);
  });

  it('returns 0 when the variant is not found', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(null);

    const count = await getInventoryCount('v-missing');

    expect(count).toBe(0);
  });
});
