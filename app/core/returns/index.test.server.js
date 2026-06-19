// app/core/returns/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    order: { findUnique: vi.fn() },
    return: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    returnLine: { create: vi.fn(), update: vi.fn() },
    orderLine: { update: vi.fn() },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

vi.mock('#/core/events/index.server', () => ({ emit: vi.fn() }));
vi.mock('#/core/inventory/index.server', () => ({
  incrementInventory: vi.fn(),
}));
vi.mock('#/core/orders/index.server', () => ({
  createRefund: vi.fn(),
}));
vi.mock('#/core/store-credit/index.server', () => ({
  issueStoreCredit: vi.fn(),
}));
vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import prisma from '#/libs/prisma.server';

import { emit } from '#/core/events/index.server';
import { incrementInventory } from '#/core/inventory/index.server';
import { createRefund } from '#/core/orders/index.server';
import { issueStoreCredit } from '#/core/store-credit/index.server';
import {
  requestReturn,
  approveReturn,
  receiveReturn,
  completeReturn,
  cancelReturn,
} from '#/core/returns/index.server';

const ORDER = {
  id: 'order-1',
  customerId: 'cust-1',
  lines: [
    {
      id: 'line-1',
      quantity: 2,
      returnedQuantity: 0,
      fulfilledQuantity: 2,
      priceCents: 1000,
      variantId: 'var-1',
    },
  ],
};

describe('returns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestReturn creates return with lines', async () => {
    prisma.order.findUnique.mockResolvedValue(ORDER);
    prisma.return.create.mockResolvedValue({ id: 'ret-1', orderId: 'order-1' });
    prisma.return.findUnique.mockResolvedValue({
      id: 'ret-1',
      orderId: 'order-1',
      customerId: 'cust-1',
      lines: [{ orderLineId: 'line-1', quantity: 1 }],
    });

    const result = await requestReturn('order-1', {
      customerId: 'cust-1',
      reason: 'Too small',
      lines: [{ orderLineId: 'line-1', quantity: 1 }],
    });

    expect(result.id).toBe('ret-1');
    expect(emit).toHaveBeenCalledWith('return.requested', expect.any(Object));
  });

  it('requestReturn rejects invalid quantity', async () => {
    prisma.order.findUnique.mockResolvedValue(ORDER);
    await expect(
      requestReturn('order-1', {
        lines: [{ orderLineId: 'line-1', quantity: 5 }],
      })
    ).rejects.toThrow('INVALID_RETURN_QUANTITY');
  });

  it('approveReturn updates status', async () => {
    prisma.return.findUnique.mockResolvedValue({
      id: 'ret-1',
      orderId: 'order-1',
      status: 'requested',
      resolution: null,
      lines: [],
    });
    prisma.return.update.mockResolvedValue({
      id: 'ret-1',
      orderId: 'order-1',
      status: 'approved',
      resolution: 'refund',
      lines: [],
    });

    const result = await approveReturn('ret-1', { resolution: 'refund' });
    expect(result.status).toBe('approved');
    expect(emit).toHaveBeenCalledWith('return.approved', expect.any(Object));
  });

  it('receiveReturn restocks inventory', async () => {
    prisma.return.findUnique
      .mockResolvedValueOnce({
        id: 'ret-1',
        orderId: 'order-1',
        status: 'approved',
        lines: [
          {
            id: 'rl-1',
            orderLineId: 'line-1',
            quantity: 1,
            orderLine: { variantId: 'var-1' },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'ret-1',
        orderId: 'order-1',
        status: 'received',
        lines: [],
      });

    await receiveReturn('ret-1');

    expect(incrementInventory).toHaveBeenCalledWith(
      [{ variantId: 'var-1', quantity: 1 }],
      prisma
    );
    expect(emit).toHaveBeenCalledWith('return.received', expect.any(Object));
    expect(emit).toHaveBeenCalledWith('order.returned', expect.any(Object));
  });

  it('completeReturn issues refund without inventory restore', async () => {
    prisma.return.findUnique
      .mockResolvedValueOnce({
        id: 'ret-1',
        orderId: 'order-1',
        status: 'received',
        resolution: 'refund',
        customerId: 'cust-1',
        reason: 'Damaged',
        lines: [{ quantity: 1, orderLine: { priceCents: 1000 } }],
      })
      .mockResolvedValueOnce({
        id: 'ret-1',
        orderId: 'order-1',
        status: 'refunded',
        lines: [],
      });
    prisma.return.update.mockResolvedValue({ id: 'ret-1', status: 'refunded' });

    await completeReturn('ret-1');

    expect(createRefund).toHaveBeenCalledWith('order-1', {
      amountCents: 1000,
      reason: 'Return ret-1',
      restoreInventory: false,
    });
  });

  it('completeReturn issues store credit', async () => {
    prisma.return.findUnique
      .mockResolvedValueOnce({
        id: 'ret-1',
        orderId: 'order-1',
        status: 'received',
        resolution: 'store_credit',
        customerId: 'cust-1',
        reason: 'Changed mind',
        lines: [{ quantity: 1, orderLine: { priceCents: 500 } }],
      })
      .mockResolvedValueOnce({
        id: 'ret-1',
        orderId: 'order-1',
        status: 'refunded',
        lines: [],
      });
    prisma.return.update.mockResolvedValue({
      id: 'ret-1',
      status: 'refunded',
      storeCreditCents: 500,
    });

    await completeReturn('ret-1', { resolution: 'store_credit' });

    expect(issueStoreCredit).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ amountCents: 500, referenceType: 'return' }),
      prisma
    );
  });

  it('cancelReturn cancels requested return', async () => {
    prisma.return.findUnique.mockResolvedValue({
      id: 'ret-1',
      orderId: 'order-1',
      status: 'requested',
      lines: [],
    });
    prisma.return.update.mockResolvedValue({
      id: 'ret-1',
      status: 'cancelled',
      lines: [],
    });

    const result = await cancelReturn('ret-1');
    expect(result.status).toBe('cancelled');
  });
});
