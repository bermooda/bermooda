// app/core/reporting/index.server.js
// Sales analytics and operational reports for the admin dashboard.

import prisma from '#/libs/prisma.server';
import {
  loadCategoryTitleMap,
  loadProductTitleMap,
} from '#/core/catalog/translations.server';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';
import { get } from '#/core/settings/index.server';
import { DEFAULT_CURRENCY } from '#/core/settings/defaults';
import { SETTING_KEYS } from '#/core/settings/keys';

export const PAID_ORDER_STATUSES = ['paid', 'fulfilled', 'refunded'];
const REFUND_COMPLETED_STATUSES = ['completed', 'succeeded', 'paid'];

export const DEFAULT_REPORT_LIMIT = 20;
export const MAX_REPORT_LIMIT = 100;

/**
 * Parse a date-range filter with sensible defaults (last 30 days).
 *
 * @param {{ startDate?: string, endDate?: string }} params
 * @returns {{ start: Date, end: Date }}
 */
export function parseDateRange({ startDate, endDate } = {}) {
  const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();
  const start = startDate
    ? new Date(`${startDate}T00:00:00.000Z`)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Build a Prisma createdAt filter for the given range.
 *
 * @param {{ start: Date, end: Date }} range
 */
export function buildCreatedAtFilter(range) {
  return { gte: range.start, lte: range.end };
}

/**
 * Prisma where clause for paid orders in a date range.
 *
 * @param {{ startDate?: string, endDate?: string }} params
 */
export function buildPaidOrderWhere(params = {}) {
  const range = parseDateRange(params);
  return {
    createdAt: buildCreatedAtFilter(range),
    status: { in: PAID_ORDER_STATUSES },
  };
}

/**
 * Prisma where clause for order lines on paid orders in a date range.
 *
 * @param {{ startDate?: string, endDate?: string }} params
 */
function buildPaidOrderLineWhere(params = {}) {
  return { order: buildPaidOrderWhere(params) };
}

/**
 * Parse report query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {{ startDate?: string, endDate?: string, locale: string, limit: number }}
 */
export function parseReportParams(source = {}) {
  const get = (key) => {
    if (source instanceof URLSearchParams) {
      const value = source.get(key);
      return value === null || value === '' ? undefined : value;
    }
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    return value.toString();
  };

  const startDate = get('startDate')?.trim();
  const endDate = get('endDate')?.trim();
  const locale = get('locale')?.trim() || DEFAULT_LOCALE;
  const limit = Math.min(
    Math.max(
      1,
      parseInt(get('limit') ?? String(DEFAULT_REPORT_LIMIT), 10) ||
        DEFAULT_REPORT_LIMIT
    ),
    MAX_REPORT_LIMIT
  );

  return {
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    locale,
    limit,
  };
}

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
 * Daily sales buckets for the date range.
 *
 * @param {{ startDate?: string, endDate?: string }} params
 */
export async function getSalesOverTime(params = {}) {
  const orders = await prisma.order.findMany({
    where: buildPaidOrderWhere(params),
    select: {
      createdAt: true,
      totalCents: true,
      taxCents: true,
      discountCents: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  /** @type {Map<string, { date: string, orders: number, revenueCents: number, taxCents: number, discountCents: number }>} */
  const buckets = new Map();

  for (const order of orders) {
    const date = order.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(date) ?? {
      date,
      orders: 0,
      revenueCents: 0,
      taxCents: 0,
      discountCents: 0,
    };
    bucket.orders += 1;
    bucket.revenueCents += order.totalCents;
    bucket.taxCents += order.taxCents;
    bucket.discountCents += order.discountCents;
    buckets.set(date, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Revenue and quantity grouped by product (order line title / variant).
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} params
 */
export async function getSalesByProduct(params = {}) {
  const limit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_REPORT_LIMIT),
    MAX_REPORT_LIMIT
  );

  const lines = await prisma.orderLine.findMany({
    where: buildPaidOrderLineWhere(params),
    select: {
      title: true,
      sku: true,
      variantId: true,
      quantity: true,
      totalCents: true,
    },
  });

  /** @type {Map<string, { title: string, sku: string|null, variantId: string|null, quantity: number, revenueCents: number }>} */
  const byKey = new Map();

  for (const line of lines) {
    const key = line.variantId ?? line.title;
    const row = byKey.get(key) ?? {
      title: line.title,
      sku: line.sku,
      variantId: line.variantId,
      quantity: 0,
      revenueCents: 0,
    };
    row.quantity += line.quantity;
    row.revenueCents += line.totalCents;
    byKey.set(key, row);
  }

  return [...byKey.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, limit);
}

/**
 * Revenue grouped by category. Lines with multiple categories split revenue evenly.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number, locale?: string }} params
 */
export async function getSalesByCategory(params = {}) {
  const limit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_REPORT_LIMIT),
    MAX_REPORT_LIMIT
  );
  const locale = params.locale ?? DEFAULT_LOCALE;

  const lines = await prisma.orderLine.findMany({
    where: {
      ...buildPaidOrderLineWhere(params),
      variantId: { not: null },
    },
    select: {
      totalCents: true,
      variant: {
        select: {
          product: {
            select: {
              categories: {
                select: {
                  category: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const categoryIds = [
    ...new Set(
      lines.flatMap((line) =>
        (line.variant?.product?.categories ?? []).map((pc) => pc.category.id)
      )
    ),
  ];

  const titleById = await loadCategoryTitleMap(categoryIds, locale);

  /** @type {Map<string, { categoryId: string, title: string, revenueCents: number }>} */
  const byCategory = new Map();

  for (const line of lines) {
    const categories = line.variant?.product?.categories ?? [];
    if (categories.length === 0) {
      const uncategorized = byCategory.get('uncategorized') ?? {
        categoryId: 'uncategorized',
        title: 'Uncategorized',
        revenueCents: 0,
      };
      uncategorized.revenueCents += line.totalCents;
      byCategory.set('uncategorized', uncategorized);
      continue;
    }

    const share = Math.round(line.totalCents / categories.length);
    for (const { category } of categories) {
      const row = byCategory.get(category.id) ?? {
        categoryId: category.id,
        title: titleById.get(category.id) ?? category.id,
        revenueCents: 0,
      };
      row.revenueCents += share;
      byCategory.set(category.id, row);
    }
  }

  return [...byCategory.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, limit);
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

export const LOW_STOCK_THRESHOLD = 5;

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
      (a, b) =>
        b.revenueCents - a.revenueCents || b.orderCount - a.orderCount
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
 * Snapshot inventory analytics (not date-ranged).
 *
 * @param {{ limit?: number, locale?: string, currency?: string, threshold?: number }} [params]
 * @returns {Promise<{
 *   asOf: string,
 *   currency: string,
 *   threshold: number,
 *   lowStock: {
 *     count: number,
 *     variants: Array<{
 *       id: string,
 *       sku: string | null,
 *       inventoryCount: number,
 *       title: string | null,
 *     }>,
 *   },
 *   outOfStock: {
 *     count: number,
 *     variants: Array<{
 *       id: string,
 *       sku: string | null,
 *       inventoryCount: number,
 *       title: string | null,
 *     }>,
 *   },
 *   stockValueCents: number,
 *   byLocation: Array<{
 *     locationId: string,
 *     name: string,
 *     code: string | null,
 *     units: number,
 *     stockValueCents: number,
 *   }>,
 * }>}
 */
export async function getInventoryMetrics(params = {}) {
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );
  const threshold = Math.max(
    Number(params.threshold) || LOW_STOCK_THRESHOLD,
    1
  );
  const locale = params.locale;
  const currency =
    params.currency?.trim() ||
    (await get(SETTING_KEYS.DEFAULT_CURRENCY)) ||
    DEFAULT_CURRENCY;

  const tracked = await prisma.productVariant.findMany({
    where: { inventoryTracked: true },
    select: {
      id: true,
      sku: true,
      inventoryCount: true,
      productId: true,
    },
  });

  const titleByProductId = await loadProductTitleMap(
    tracked.map((v) => v.productId),
    locale || undefined
  );

  const prices = await prisma.variantPrice.findMany({
    where: {
      variantId: { in: tracked.map((v) => v.id) },
      currency,
    },
    select: { variantId: true, priceCents: true },
  });
  const priceByVariant = new Map(
    prices.map((p) => [p.variantId, p.priceCents])
  );

  const lowStockVariants = tracked
    .filter((v) => v.inventoryCount > 0 && v.inventoryCount < threshold)
    .sort((a, b) => a.inventoryCount - b.inventoryCount);
  const outOfStockVariants = tracked.filter((v) => v.inventoryCount === 0);

  let stockValueCents = 0;
  for (const v of tracked) {
    stockValueCents += v.inventoryCount * (priceByVariant.get(v.id) ?? 0);
  }

  const levels = await prisma.inventoryLevel.findMany({
    select: { locationId: true, variantId: true, quantity: true },
  });
  const locations = await prisma.location.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
  });
  const locById = new Map(locations.map((l) => [l.id, l]));

  /** @type {Map<string, { locationId: string, name: string, code: string | null, units: number, stockValueCents: number }>} */
  const byLoc = new Map();
  for (const level of levels) {
    const loc = locById.get(level.locationId);
    if (!loc) continue;
    const row = byLoc.get(loc.id) ?? {
      locationId: loc.id,
      name: loc.name,
      code: loc.code,
      units: 0,
      stockValueCents: 0,
    };
    row.units += level.quantity;
    row.stockValueCents +=
      level.quantity * (priceByVariant.get(level.variantId) ?? 0);
    byLoc.set(loc.id, row);
  }

  /**
   * @param {{ id: string, sku: string | null, inventoryCount: number, productId: string }} v
   */
  const mapVariant = (v) => ({
    id: v.id,
    sku: v.sku,
    inventoryCount: v.inventoryCount,
    title: titleByProductId.get(v.productId) ?? null,
  });

  return {
    asOf: new Date().toISOString(),
    currency,
    threshold,
    lowStock: {
      count: lowStockVariants.length,
      variants: lowStockVariants.slice(0, limit).map(mapVariant),
    },
    outOfStock: {
      count: outOfStockVariants.length,
      variants: outOfStockVariants.slice(0, limit).map(mapVariant),
    },
    stockValueCents,
    byLocation: [...byLoc.values()].sort((a, b) => b.units - a.units),
  };
}

/**
 * Operational metrics for agents and dashboards.
 * Abandoned checkouts and recent orders respect the date range;
 * low stock is a current snapshot.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} [params]
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
          product: { select: { title: true } },
        },
      }),
    ]);

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
        title: variant.product?.title ?? null,
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
