// app/core/reporting/kpis.server.js
// Overview KPIs, customers, ops, and dashboard aggregates.

import prisma from '#/libs/prisma.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { LOW_STOCK_THRESHOLD } from '#/core/reporting/inventory.server';
import {
  getSalesByCategory,
  getSalesByProduct,
  getSalesOverTime,
} from '#/core/reporting/sales.server';
import {
  DEFAULT_REPORT_LIMIT,
  MAX_REPORT_LIMIT,
  PAID_ORDER_STATUSES,
  parseDateRange,
  buildCreatedAtFilter,
} from '#/core/reporting/shared.server';

const REFUND_COMPLETED_STATUSES = ['completed', 'succeeded', 'paid'];

/**
 * Overview KPIs: revenue, orders, AOV, tax, discounts, refunds, conversion.
 *
 * @param {{ startDate?: string, endDate?: string }} params
 */
export async function getOverviewMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = buildCreatedAtFilter(range);

  const [
    orderAgg,
    orderCount,
    refundAgg,
    completedCheckouts,
    startedCheckouts,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: dateFilter, status: { in: PAID_ORDER_STATUSES } },
      _sum: {
        totalCents: true,
        taxCents: true,
        discountCents: true,
        subtotalCents: true,
      },
      _count: true,
    }),
    prisma.order.count({ where: { createdAt: dateFilter } }),
    prisma.refund.aggregate({
      where: {
        createdAt: dateFilter,
        status: { in: REFUND_COMPLETED_STATUSES },
      },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.checkoutSession.count({
      where: { createdAt: dateFilter, step: 'complete' },
    }),
    prisma.checkoutSession.count({
      where: { createdAt: dateFilter },
    }),
  ]);

  const paidOrders = orderAgg._count;
  const revenueCents = orderAgg._sum.totalCents ?? 0;
  const taxCents = orderAgg._sum.taxCents ?? 0;
  const discountCents = orderAgg._sum.discountCents ?? 0;
  const refundCents = refundAgg._sum.amountCents ?? 0;
  const refundCount = refundAgg._count;
  const aovCents = paidOrders > 0 ? Math.round(revenueCents / paidOrders) : 0;
  const conversionRate =
    startedCheckouts > 0
      ? Math.round((completedCheckouts / startedCheckouts) * 10000) / 100
      : 0;

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    orderCount,
    paidOrders,
    revenueCents,
    taxCents,
    discountCents,
    refundCents,
    refundCount,
    aovCents,
    conversionRate,
    completedCheckouts,
    startedCheckouts,
  };
}

/**
 * Load KPI data and recent orders for the admin home dashboard.
 */
export async function loadAdminDashboardData() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    totalOrders,
    revenueAgg,
    abandonedCheckouts,
    lowStockCount,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: { totalCents: true },
    }),
    prisma.checkoutSession.count({
      where: {
        step: { not: 'complete' },
        createdAt: { lt: oneHourAgo },
      },
    }),
    prisma.productVariant.count({
      where: {
        inventoryTracked: true,
        inventoryCount: { lt: 5 },
      },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        customer: {
          select: { email: true },
        },
      },
    }),
  ]);

  return {
    totalOrders,
    totalRevenueCents: revenueAgg._sum.totalCents ?? 0,
    abandonedCheckouts,
    lowStockCount,
    recentOrders: recentOrders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

/**
 * Customer analytics for a date range.
 * Guest orders (null customerId) are excluded from order-based metrics.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} [params]
 * @returns {Promise<{
 *   range: { start: string, end: string },
 *   newCustomers: number,
 *   returningCustomers: number,
 *   ordersByNewVsReturning: {
 *     new: { orders: number, revenueCents: number },
 *     returning: { orders: number, revenueCents: number },
 *   },
 *   topCustomers: Array<{
 *     customerId: string,
 *     email: string | null,
 *     name: string | null,
 *     revenueCents: number,
 *     orderCount: number,
 *   }>,
 * }>}
 */
export async function getCustomerMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = buildCreatedAtFilter(range);
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );
  const paid = { status: { in: PAID_ORDER_STATUSES } };

  const [newCustomers, allTimePaidCustomerIds, rangedPaidOrders] =
    await Promise.all([
      prisma.customer.count({ where: { createdAt: dateFilter } }),
      prisma.order.findMany({
        where: { ...paid, customerId: { not: null } },
        select: { customerId: true },
      }),
      prisma.order.findMany({
        where: {
          ...paid,
          customerId: { not: null },
          createdAt: dateFilter,
        },
        select: {
          customerId: true,
          totalCents: true,
          customer: {
            select: { id: true, email: true, name: true, createdAt: true },
          },
        },
      }),
    ]);

  /** @type {Map<string, number>} */
  const allTimeCount = new Map();
  for (const row of allTimePaidCustomerIds) {
    if (!row.customerId) continue;
    allTimeCount.set(
      row.customerId,
      (allTimeCount.get(row.customerId) ?? 0) + 1
    );
  }

  const returningIds = new Set(
    [...allTimeCount.entries()]
      .filter(([, count]) => count >= 2)
      .map(([id]) => id)
  );

  const rangedCustomerIds = new Set(
    rangedPaidOrders.map((o) => o.customerId).filter(Boolean)
  );
  let returningCustomers = 0;
  for (const id of returningIds) {
    if (rangedCustomerIds.has(id)) returningCustomers += 1;
  }

  const ordersByNewVsReturning = {
    new: { orders: 0, revenueCents: 0 },
    returning: { orders: 0, revenueCents: 0 },
  };

  /** @type {Map<string, { customerId: string, email: string | null, name: string | null, revenueCents: number, orderCount: number }>} */
  const topMap = new Map();

  for (const order of rangedPaidOrders) {
    if (!order.customerId || !order.customer) continue;
    const isNew =
      order.customer.createdAt.getTime() >= range.start.getTime() &&
      order.customer.createdAt.getTime() <= range.end.getTime();
    const bucket = isNew
      ? ordersByNewVsReturning.new
      : ordersByNewVsReturning.returning;
    bucket.orders += 1;
    bucket.revenueCents += order.totalCents;

    const row = topMap.get(order.customerId) ?? {
      customerId: order.customerId,
      email: order.customer.email,
      name: order.customer.name,
      revenueCents: 0,
      orderCount: 0,
    };
    row.revenueCents += order.totalCents;
    row.orderCount += 1;
    topMap.set(order.customerId, row);
  }

  const topCustomers = [...topMap.values()]
    .sort(
      (a, b) => b.revenueCents - a.revenueCents || b.orderCount - a.orderCount
    )
    .slice(0, limit);

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    newCustomers,
    returningCustomers,
    ordersByNewVsReturning,
    topCustomers,
  };
}

/**
 * Operational metrics for agents and dashboards.
 * Abandoned checkouts and recent orders respect the date range;
 * low stock is a current snapshot.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number, locale?: string }} [params]
 * @returns {Promise<{
 *   range: { start: string, end: string },
 *   asOf: string,
 *   abandonedCheckouts: number,
 *   recentOrders: Array<Record<string, unknown>>,
 *   lowStock: {
 *     threshold: number,
 *     count: number,
 *     variants: Array<{
 *       id: string,
 *       sku: string | null,
 *       inventoryCount: number,
 *       title: string | null,
 *     }>,
 *   },
 * }>}
 */
export async function getOpsMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = buildCreatedAtFilter(range);
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );
  const locale = params.locale;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const lowStockWhere = {
    inventoryTracked: true,
    inventoryCount: { lt: LOW_STOCK_THRESHOLD },
  };

  const [abandonedCheckouts, recentOrders, lowStockCount, lowStockVariants] =
    await Promise.all([
      prisma.checkoutSession.count({
        where: {
          step: { not: 'complete' },
          createdAt: {
            gte: dateFilter.gte,
            lte: dateFilter.lte,
            lt: oneHourAgo,
          },
        },
      }),
      prisma.order.findMany({
        where: { createdAt: dateFilter },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          email: true,
          status: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          customer: { select: { email: true } },
        },
      }),
      prisma.productVariant.count({ where: lowStockWhere }),
      prisma.productVariant.findMany({
        where: lowStockWhere,
        take: limit,
        orderBy: { inventoryCount: 'asc' },
        select: {
          id: true,
          sku: true,
          inventoryCount: true,
          productId: true,
        },
      }),
    ]);

  const titleByProductId = await loadProductTitleMap(
    lowStockVariants.map((v) => v.productId),
    locale || undefined
  );

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    asOf: new Date().toISOString(),
    abandonedCheckouts,
    recentOrders: recentOrders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })),
    lowStock: {
      threshold: LOW_STOCK_THRESHOLD,
      count: lowStockCount,
      variants: lowStockVariants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        inventoryCount: variant.inventoryCount,
        title: titleByProductId.get(variant.productId) ?? null,
      })),
    },
  };
}

/**
 * Full dashboard report payload.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number, locale?: string }} params
 */
export async function getDashboardReport(params = {}) {
  const [overview, salesOverTime, salesByProduct, salesByCategory, ops] =
    await Promise.all([
      getOverviewMetrics(params),
      getSalesOverTime(params),
      getSalesByProduct(params),
      getSalesByCategory(params),
      getOpsMetrics(params),
    ]);

  return { overview, salesOverTime, salesByProduct, salesByCategory, ops };
}
