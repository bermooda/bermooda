// app/core/back-in-stock/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    backInStockSubscription: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    productVariant: { findUnique: vi.fn() },
  },
}));

vi.mock('#/emails/index.server', () => ({
  sendBackInStockEmail: vi.fn(),
}));

import prisma from '#/libs/prisma.server';

import { sendBackInStockEmail } from '#/emails/index.server';

import {
  notifyBackInStockSubscribers,
  subscribeBackInStock,
} from '#/core/back-in-stock/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('back-in-stock', () => {
  it('subscribeBackInStock normalizes email', async () => {
    prisma.backInStockSubscription.upsert.mockResolvedValue({ id: 's1' });

    await subscribeBackInStock({
      variantId: 'v1',
      email: ' Shop@Example.com ',
    });

    expect(prisma.backInStockSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { variantId_email: { variantId: 'v1', email: 'shop@example.com' } },
      })
    );
  });

  it('notifyBackInStockSubscribers sends emails and marks notified', async () => {
    prisma.backInStockSubscription.findMany.mockResolvedValue([
      { id: 's1', email: 'buyer@example.com' },
    ]);
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'v1',
      sku: 'SKU-1',
      product: {},
    });
    sendBackInStockEmail.mockResolvedValue({ success: true });
    prisma.backInStockSubscription.update.mockResolvedValue({});

    const result = await notifyBackInStockSubscribers('v1');

    expect(result.notified).toBe(1);
    expect(sendBackInStockEmail).toHaveBeenCalledWith({
      to: 'buyer@example.com',
      variant: expect.objectContaining({ id: 'v1' }),
    });
  });
});
