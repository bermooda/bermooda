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
      count: vi.fn(),
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
vi.mock('#/core/orders/refunds.server', () => ({
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
import { createRefund } from '#/core/orders/refunds.server';
import {
  approveReturn,
  buildReturnWhere,
  cancelReturn,
  computeReturnAmountCents,
  completeReturn,
  getReturn,
  listReturns,
  parseCompleteReturnInput,
  parseRequestReturnInput,
  parseReturnLinesFromForm,
  parseReturnLinesInput,
  parseReturnListParams,
  receiveReturn,
  requestReturn,
  serializeReturn,
} from '#/core/returns/index.server';
import { issueStoreCredit } from '#/core/store-credit/index.server';

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

const RETURN_RECORD = {
  id: 'ret-1',
  orderId: 'order-1',
  customerId: 'cust-1',
  status: 'requested',
  reason: 'Too small',
  resolution: null,
  storeCreditCents: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  order: { orderNumber: '1001', email: 'a@example.com', customerId: 'cust-1' },
  lines: [
    {
      id: 'rl-1',
      orderLineId: 'line-1',
      quantity: 1,
      restocked: false,
      orderLine: {
        title: 'Shirt',
        sku: 'SH-1',
        priceCents: 1000,
        variantId: 'var-1',
      },
    },
  ],
};

describe('returns helpers', () => {
  it('parseReturnListParams applies defaults and caps limit', () => {
    expect(parseReturnListParams(new URLSearchParams())).toEqual({
      page: 1,
      limit: 20,
    });
    expect(parseReturnListParams(new URLSearchParams('limit=999'))).toEqual({
      page: 1,
      limit: 100,
    });
    expect(
      parseReturnListParams(new URLSearchParams('status=requested&orderId=o1'))
    ).toEqual({
      page: 1,
      limit: 20,
      status: 'requested',
      orderId: 'o1',
    });
  });

  it('parseReturnListParams rejects invalid status', () => {
    expect(() =>
      parseReturnListParams(new URLSearchParams('status=invalid'))
    ).toThrow('Invalid return status filter.');
  });

  it('buildReturnWhere maps filters', () => {
    expect(buildReturnWhere({ orderId: 'o1', status: 'requested' })).toEqual({
      orderId: 'o1',
      status: 'requested',
    });
  });

  it('parseReturnLinesInput validates lines', () => {
    expect(parseReturnLinesInput([{ orderLineId: 'l1', quantity: 1 }])).toEqual(
      [{ orderLineId: 'l1', quantity: 1 }]
    );
    expect(() => parseReturnLinesInput([])).toThrow(
      'Return lines are required.'
    );
  });

  it('parseRequestReturnInput normalizes reason and lines', () => {
    expect(
      parseRequestReturnInput({
        reason: '  damaged ',
        lines: [{ orderLineId: 'l1', quantity: '2' }],
      })
    ).toEqual({
      reason: 'damaged',
      lines: [{ orderLineId: 'l1', quantity: 2 }],
    });
  });

  it('parseReturnLinesFromForm reads qty fields', () => {
    const formData = new FormData();
    formData.set('qty-line-1', '2');
    formData.set('qty-line-2', '0');
    expect(parseReturnLinesFromForm(formData)).toEqual([
      { orderLineId: 'line-1', quantity: 2 },
    ]);
  });

  it('parseCompleteReturnInput validates refund amount', () => {
    expect(parseCompleteReturnInput({ resolution: 'refund' })).toEqual({
      resolution: 'refund',
      refundAmountCents: undefined,
    });
    expect(() => parseCompleteReturnInput({ refundAmountCents: -1 })).toThrow(
      'refundAmountCents must be a number.'
    );
  });

  it('computeReturnAmountCents sums line totals', () => {
    expect(
      computeReturnAmountCents([
        { quantity: 2, orderLine: { priceCents: 500 } },
        { quantity: 1, orderLine: { priceCents: 1000 } },
      ])
    ).toBe(2000);
  });

  it('serializeReturn formats dates and nested lines', () => {
    const serialized = serializeReturn(RETURN_RECORD);
    expect(serialized.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(serialized.lines[0].title).toBe('Shirt');
  });
});

describe('returns workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestReturn creates return with lines', async () => {
    prisma.order.findUnique.mockResolvedValue(ORDER);
    prisma.return.create.mockResolvedValue({ id: 'ret-1', orderId: 'order-1' });
    prisma.return.findUnique.mockResolvedValue(RETURN_RECORD);

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
    ).rejects.toMatchObject({ code: 'INVALID_RETURN_QUANTITY' });
  });

  it('getReturn throws NOT_FOUND for missing return', async () => {
    prisma.return.findUnique.mockResolvedValue(null);
    await expect(getReturn('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('listReturns returns paginated payload', async () => {
    prisma.return.findMany.mockResolvedValue([RETURN_RECORD]);
    prisma.return.count.mockResolvedValue(1);

    const result = await listReturns({
      page: 1,
      limit: 20,
      status: 'requested',
    });

    expect(result.returns).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(prisma.return.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'requested' },
      })
    );
  });

  it('approveReturn updates status', async () => {
    prisma.return.findUnique.mockResolvedValue(RETURN_RECORD);
    prisma.return.update.mockResolvedValue({
      ...RETURN_RECORD,
      status: 'approved',
      resolution: 'refund',
    });

    const result = await approveReturn('ret-1', { resolution: 'refund' });
    expect(result.status).toBe('approved');
    expect(emit).toHaveBeenCalledWith('return.approved', expect.any(Object));
  });

  it('receiveReturn restocks inventory', async () => {
    prisma.return.findUnique
      .mockResolvedValueOnce({
        ...RETURN_RECORD,
        status: 'approved',
      })
      .mockResolvedValueOnce({
        ...RETURN_RECORD,
        status: 'received',
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
        ...RETURN_RECORD,
        status: 'received',
        resolution: 'refund',
      })
      .mockResolvedValueOnce({
        ...RETURN_RECORD,
        status: 'refunded',
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
        ...RETURN_RECORD,
        status: 'received',
        resolution: 'store_credit',
        lines: [
          {
            id: 'rl-1',
            orderLineId: 'line-1',
            quantity: 1,
            orderLine: { priceCents: 500, variantId: 'var-1' },
          },
        ],
      })
      .mockResolvedValueOnce({
        ...RETURN_RECORD,
        status: 'refunded',
        storeCreditCents: 500,
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
    prisma.return.findUnique.mockResolvedValue(RETURN_RECORD);
    prisma.return.update.mockResolvedValue({
      ...RETURN_RECORD,
      status: 'cancelled',
    });

    const result = await cancelReturn('ret-1');
    expect(result.status).toBe('cancelled');
  });
});
