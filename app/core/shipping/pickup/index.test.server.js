import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    location: {
      findMany: vi.fn(),
    },
    inventoryLevel: {
      findMany: vi.fn(),
    },
    productVariant: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('#/libs/prisma.server', () => ({
  default: prismaMock,
}));

import { pickupProvider } from '#/core/shipping/pickup/index.server';

describe('pickupProvider.getQuotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pickup options for locations with stock', async () => {
    prismaMock.location.findMany.mockResolvedValue([
      {
        id: 'loc_1',
        name: 'Downtown Store',
        addressJson: JSON.stringify({
          line1: '1 Main St',
          city: 'Sydney',
          state: 'NSW',
          postalCode: '2000',
        }),
      },
    ]);

    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: 'var_1', inventoryTracked: true },
    ]);
    prismaMock.inventoryLevel.findMany.mockResolvedValue([
      {
        variantId: 'var_1',
        quantity: 5,
        variant: { inventoryTracked: true },
      },
    ]);

    const cart = {
      lines: [{ variantId: 'var_1', quantity: 2 }],
    };

    const quotes = await pickupProvider.getQuotes({ cart });

    expect(quotes).toHaveLength(1);
    expect(quotes[0].id).toBe('pickup:loc_1');
    expect(quotes[0].providerId).toBe('pickup');
    expect(quotes[0].priceCents).toBe(0);
    expect(quotes[0].pickupLocationId).toBe('loc_1');
  });

  it('skips locations without sufficient stock', async () => {
    prismaMock.location.findMany.mockResolvedValue([
      { id: 'loc_1', name: 'Empty Store', addressJson: null },
    ]);

    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: 'var_1', inventoryTracked: true },
    ]);
    prismaMock.inventoryLevel.findMany.mockResolvedValue([
      {
        variantId: 'var_1',
        quantity: 0,
        variant: { inventoryTracked: true },
      },
    ]);

    const quotes = await pickupProvider.getQuotes({
      cart: { lines: [{ variantId: 'var_1', quantity: 1 }] },
    });

    expect(quotes).toHaveLength(0);
  });

  it('skips locations when tracked variants have no inventory record', async () => {
    prismaMock.location.findMany.mockResolvedValue([
      { id: 'loc_1', name: 'No Stock Record', addressJson: null },
    ]);

    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: 'var_1', inventoryTracked: true },
    ]);
    prismaMock.inventoryLevel.findMany.mockResolvedValue([]);

    const quotes = await pickupProvider.getQuotes({
      cart: { lines: [{ variantId: 'var_1', quantity: 1 }] },
    });

    expect(quotes).toHaveLength(0);
  });
});
