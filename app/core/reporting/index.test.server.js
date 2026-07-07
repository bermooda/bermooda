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
    productVariant: {
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
  parseReportParams,
  getOverviewMetrics,
  getSalesOverTime,
  getSalesByProduct,
  getSalesByCategory,
  getDashboardReport,
  loadAdminDashboardData,
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

  it('parseDateRange honors explicit dates', () => {
    const { start, end } = parseDateRange({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-01-31T23:59:59.999Z');
  });

  it('parseReportParams normalizes filters and caps limit', () => {
    const params = new URLSearchParams({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      limit: '500',
      locale: 'de',
    });
    expect(parseReportParams(params)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      locale: 'de',
      limit: 100,
    });
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

  it('getSalesByCategory splits revenue across categories and labels uncategorized', async () => {
    prisma.orderLine.findMany.mockResolvedValue([
      {
        totalCents: 3000,
        variant: {
          product: {
            categories: [
              { category: { id: 'c1' } },
              { category: { id: 'c2' } },
            ],
          },
        },
      },
      {
        totalCents: 1000,
        variant: {
          product: {
            categories: [],
          },
        },
      },
    ]);
    prisma.translation.findMany.mockResolvedValue([
      { entityId: 'c1', value: 'Shirts' },
      { entityId: 'c2', value: 'Sale' },
    ]);

    const rows = await getSalesByCategory({ limit: 10, locale: 'en' });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: 'c1',
          title: 'Shirts',
          revenueCents: 1500,
        }),
        expect.objectContaining({
          categoryId: 'c2',
          title: 'Sale',
          revenueCents: 1500,
        }),
        expect.objectContaining({
          categoryId: 'uncategorized',
          title: 'Uncategorized',
          revenueCents: 1000,
        }),
      ])
    );
  });

  it('getDashboardReport composes all sections', async () => {
    prisma.order.aggregate.mockResolvedValue({
      _sum: {
        totalCents: 1000,
        taxCents: 100,
        discountCents: 0,
        subtotalCents: 900,
      },
      _count: 1,
    });
    prisma.order.count.mockResolvedValue(1);
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amountCents: 0 },
      _count: 0,
    });
    prisma.checkoutSession.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prisma.order.findMany.mockResolvedValue([]);
    prisma.orderLine.findMany.mockResolvedValue([]);

    const report = await getDashboardReport({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(report).toEqual({
      overview: expect.objectContaining({ revenueCents: 1000 }),
      salesOverTime: [],
      salesByProduct: [],
      salesByCategory: [],
    });
  });

  it('loadAdminDashboardData returns KPI payload', async () => {
    prisma.order.count.mockResolvedValue(12);
    prisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 45000 } });
    prisma.checkoutSession.count.mockResolvedValue(3);
    prisma.productVariant.count.mockResolvedValue(2);
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'ord_1',
        orderNumber: 1001,
        email: 'buyer@example.com',
        status: 'paid',
        totalCents: 2500,
        currency: 'USD',
        createdAt: new Date('2026-01-15T12:00:00.000Z'),
        customer: { email: 'buyer@example.com' },
      },
    ]);

    const data = await loadAdminDashboardData();

    expect(data).toEqual({
      totalOrders: 12,
      totalRevenueCents: 45000,
      abandonedCheckouts: 3,
      lowStockCount: 2,
      recentOrders: [
        expect.objectContaining({
          id: 'ord_1',
          orderNumber: 1001,
          createdAt: '2026-01-15T12:00:00.000Z',
        }),
      ],
    });
  });
});
