// app/core/reporting/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    order: {
      aggregate: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    refund: {
      aggregate: vi.fn(),
    },
    checkoutSession: {
      count: vi.fn(),
    },
    orderLine: {
      findMany: vi.fn(),
    },
    translation: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import {
  parseDateRange,
  getOverviewMetrics,
  getSalesOverTime,
  getSalesByProduct,
} from '#/core/reporting/index.server';

describe('reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseDateRange defaults to last 30 days', () => {
    const { start, end } = parseDateRange({});
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(30, 0);
  });

  it('getOverviewMetrics computes AOV and conversion', async () => {
    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        totalCents: 10000,
        taxCents: 800,
        discountCents: 500,
        subtotalCents: 9000,
      },
      _count: 4,
    });
    prisma.order.count.mockResolvedValue(5);
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amountCents: 1000 },
      _count: 1,
    });
    prisma.checkoutSession.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(10);

    const result = await getOverviewMetrics({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(result.revenueCents).toBe(10000);
    expect(result.aovCents).toBe(2500);
    expect(result.conversionRate).toBe(20);
    expect(result.taxCents).toBe(800);
    expect(result.discountCents).toBe(500);
  });

  it('getSalesOverTime buckets orders by date', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-01-10T12:00:00Z'),
        totalCents: 2000,
        taxCents: 100,
        discountCents: 0,
      },
      {
        createdAt: new Date('2026-01-10T15:00:00Z'),
        totalCents: 3000,
        taxCents: 200,
        discountCents: 50,
      },
      {
        createdAt: new Date('2026-01-11T09:00:00Z'),
        totalCents: 1000,
        taxCents: 50,
        discountCents: 0,
      },
    ]);

    const buckets = await getSalesOverTime({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({
      date: '2026-01-10',
      orders: 2,
      revenueCents: 5000,
    });
    expect(buckets[1]).toMatchObject({
      date: '2026-01-11',
      orders: 1,
      revenueCents: 1000,
    });
  });

  it('getSalesByProduct aggregates line items', async () => {
    prisma.orderLine.findMany.mockResolvedValue([
      {
        title: 'T-Shirt',
        sku: 'TS-1',
        variantId: 'v1',
        quantity: 2,
        totalCents: 4000,
      },
      {
        title: 'T-Shirt',
        sku: 'TS-1',
        variantId: 'v1',
        quantity: 1,
        totalCents: 2000,
      },
      {
        title: 'Hat',
        sku: 'H-1',
        variantId: 'v2',
        quantity: 1,
        totalCents: 1500,
      },
    ]);

    const rows = await getSalesByProduct({ limit: 10 });

    expect(rows[0]).toMatchObject({
      title: 'T-Shirt',
      quantity: 3,
      revenueCents: 6000,
    });
    expect(rows[1]).toMatchObject({
      title: 'Hat',
      quantity: 1,
      revenueCents: 1500,
    });
  });
});
