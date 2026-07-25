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
      findMany: vi.fn(),
    },
    orderLine: {
      findMany: vi.fn(),
    },
    translation: {
      findMany: vi.fn(),
    },
    customer: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryLevel: {
      findMany: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
    },
    variantPrice: {
      findMany: vi.fn(),
    },
    scheduledExport: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    exportRun: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('#/core/catalog/translations.server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadProductTitleMap: vi.fn(
      async () =>
        new Map([
          ['p1', 'Hat'],
          ['p2', 'Cap'],
        ])
    ),
  };
});

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
  getOpsMetrics,
  getCustomerMetrics,
  getInventoryMetrics,
  getExportMetrics,
} from '#/core/reporting/index.server';

describe('reporting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
      .mockResolvedValueOnce(1) // overview completed
      .mockResolvedValueOnce(1) // overview started
      .mockResolvedValueOnce(0); // ops abandoned
    prisma.order.findMany.mockResolvedValue([]);
    prisma.orderLine.findMany.mockResolvedValue([]);
    prisma.productVariant.count.mockResolvedValue(0);
    prisma.productVariant.findMany.mockResolvedValue([]);

    const report = await getDashboardReport({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(report).toEqual({
      overview: expect.objectContaining({ revenueCents: 1000 }),
      salesOverTime: [],
      salesByProduct: [],
      salesByCategory: [],
      ops: expect.objectContaining({
        abandonedCheckouts: 0,
        lowStock: expect.objectContaining({ count: 0, threshold: 5 }),
      }),
    });
  });

  it('getOpsMetrics ranges abandoned/recent and snapshots low stock', async () => {
    prisma.checkoutSession.count.mockResolvedValue(4);
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
    prisma.productVariant.count.mockResolvedValue(2);
    prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'var_1',
        sku: 'SKU-1',
        inventoryCount: 1,
        product: { title: 'Hat' },
      },
    ]);

    const ops = await getOpsMetrics({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      limit: 10,
    });

    expect(ops.abandonedCheckouts).toBe(4);
    expect(ops.recentOrders).toEqual([
      expect.objectContaining({
        id: 'ord_1',
        createdAt: '2026-01-15T12:00:00.000Z',
      }),
    ]);
    expect(ops.lowStock).toEqual({
      threshold: 5,
      count: 2,
      variants: [
        expect.objectContaining({
          id: 'var_1',
          sku: 'SKU-1',
          inventoryCount: 1,
          title: 'Hat',
        }),
      ],
    });
    expect(ops.range.start).toBe('2026-01-01T00:00:00.000Z');
    expect(ops.range.end).toBe('2026-01-31T23:59:59.999Z');
    expect(typeof ops.asOf).toBe('string');

    const abandonedWhere = prisma.checkoutSession.count.mock.calls[0][0].where;
    expect(abandonedWhere.step).toEqual({ not: 'complete' });
    expect(abandonedWhere.createdAt.gte.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z'
    );
    expect(abandonedWhere.createdAt.lte.toISOString()).toBe(
      '2026-01-31T23:59:59.999Z'
    );
    expect(abandonedWhere.createdAt.lt).toBeInstanceOf(Date);

    const recentArgs = prisma.order.findMany.mock.calls[0][0];
    expect(recentArgs.take).toBe(10);
    expect(recentArgs.where.createdAt).toEqual({
      gte: expect.any(Date),
      lte: expect.any(Date),
    });

    const lowStockWhere = prisma.productVariant.count.mock.calls[0][0].where;
    expect(lowStockWhere).toEqual({
      inventoryTracked: true,
      inventoryCount: { lt: 5 },
    });
    expect(prisma.productVariant.findMany.mock.calls[0][0].where).toEqual(
      lowStockWhere
    );
  });

  it('getCustomerMetrics splits new vs returning and ranks top spenders', async () => {
    prisma.customer.count.mockResolvedValue(3);
    prisma.order.findMany
      // all-time paid: c1×2, c2×2, c3×1 → returning candidates {c1,c2}
      .mockResolvedValueOnce([
        { customerId: 'c1' },
        { customerId: 'c1' },
        { customerId: 'c2' },
        { customerId: 'c2' },
        { customerId: 'c3' },
      ])
      // in-range paid: c1 once (signup before range), c2 twice (signup in range)
      .mockResolvedValueOnce([
        {
          customerId: 'c1',
          totalCents: 5000,
          customer: {
            id: 'c1',
            email: 'a@example.com',
            name: 'A',
            createdAt: new Date('2025-06-01T00:00:00.000Z'),
          },
        },
        {
          customerId: 'c2',
          totalCents: 3000,
          customer: {
            id: 'c2',
            email: 'b@example.com',
            name: 'B',
            createdAt: new Date('2026-01-15T00:00:00.000Z'),
          },
        },
        {
          customerId: 'c2',
          totalCents: 2000,
          customer: {
            id: 'c2',
            email: 'b@example.com',
            name: 'B',
            createdAt: new Date('2026-01-15T00:00:00.000Z'),
          },
        },
      ]);

    const result = await getCustomerMetrics({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      limit: 10,
    });

    expect(result.newCustomers).toBe(3);
    expect(result.returningCustomers).toBe(2);
    expect(result.ordersByNewVsReturning).toEqual({
      new: { orders: 2, revenueCents: 5000 },
      returning: { orders: 1, revenueCents: 5000 },
    });
    expect(result.topCustomers[0]).toEqual(
      expect.objectContaining({
        customerId: 'c2',
        email: 'b@example.com',
        revenueCents: 5000,
        orderCount: 2,
      })
    );
    expect(result.range.start).toBe('2026-01-01T00:00:00.000Z');
  });

  it('getInventoryMetrics snapshots stock, value, and by-location', async () => {
    prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'v1',
        sku: 'SKU-1',
        inventoryCount: 2,
        productId: 'p1',
      },
      {
        id: 'v2',
        sku: 'SKU-2',
        inventoryCount: 0,
        productId: 'p2',
      },
    ]);
    prisma.variantPrice.findMany.mockResolvedValue([
      { variantId: 'v1', priceCents: 1000 },
      { variantId: 'v2', priceCents: 500 },
    ]);
    prisma.inventoryLevel.findMany.mockResolvedValue([
      { locationId: 'loc1', variantId: 'v1', quantity: 2 },
      { locationId: 'loc1', variantId: 'v2', quantity: 0 },
    ]);
    prisma.location.findMany.mockResolvedValue([
      { id: 'loc1', name: 'Warehouse', code: 'WH' },
    ]);

    const inv = await getInventoryMetrics({ currency: 'USD', limit: 10 });
    expect(inv.asOf).toEqual(expect.any(String));
    expect(inv.lowStock.count).toBe(1);
    expect(inv.outOfStock.count).toBe(1);
    expect(inv.stockValueCents).toBe(2000);
    expect(inv.byLocation[0]).toEqual(
      expect.objectContaining({
        locationId: 'loc1',
        name: 'Warehouse',
        units: 2,
      })
    );
  });

  it('getExportMetrics returns schedules, recent runs, and failure rate', async () => {
    prisma.scheduledExport.groupBy.mockResolvedValue([
      { exportType: 'orders', schedule: 'weekly', _count: { _all: 2 } },
    ]);
    prisma.exportRun.findMany.mockResolvedValue([
      {
        id: 'run1',
        scheduledExportId: 'se1',
        exportType: 'orders',
        status: 'failed',
        rowCount: null,
        error: 'boom',
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        completedAt: new Date('2026-01-10T00:01:00.000Z'),
        fileContent: 'x',
      },
    ]);
    prisma.exportRun.count
      .mockResolvedValueOnce(10) // total in range
      .mockResolvedValueOnce(2); // failed in range

    const result = await getExportMetrics({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      limit: 5,
    });

    expect(result.schedules).toEqual([
      expect.objectContaining({
        exportType: 'orders',
        schedule: 'weekly',
        count: 2,
      }),
    ]);
    expect(result.recentRuns[0]).toEqual(
      expect.objectContaining({
        id: 'run1',
        status: 'failed',
        error: 'boom',
        hasFileContent: true,
      })
    );
    expect(result.recentRuns[0].fileContent).toBeUndefined();
    expect(result.failureRate).toEqual({
      total: 10,
      failed: 2,
      rate: 20,
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
