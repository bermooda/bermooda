// app/core/reporting/index.server.js
// Sales analytics and operational reports for the admin dashboard.

import prisma from '#/libs/prisma.server';

const PAID_STATUSES = ['paid', 'fulfilled', 'refunded'];

/**
 * Parse a date-range filter with sensible defaults (last 30 days).
 *
 * @param {{ startDate?: string, endDate?: string }} params
 * @returns {{ start: Date, end: Date }}
 */
export function parseDateRange({ startDate, endDate } = {}) {
  const end = endDate
    ? new Date(`${endDate}T23:59:59.999Z`)
    : new Date();
  const start = startDate
    ? new Date(`${startDate}T00:00:00.000Z`)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Build a Prisma createdAt filter for the given range.
 * @param {{ start: Date, end: Date }} range
 */
function createdAtFilter(range) {
  return { gte: range.start, lte: range.end };
}

/**
 * Overview KPIs: revenue, orders, AOV, tax, discounts, refunds, conversion.
 *
 * @param {{ startDate?: string, endDate?: string }} params
 */
export async function getOverviewMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = createdAtFilter(range);

  const [
    orderAgg,
    orderCount,
    refundAgg,
    completedCheckouts,
    startedCheckouts,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: dateFilter, status: { in: PAID_STATUSES } },
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
        status: { in: ['completed', 'succeeded', 'paid'] },
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
  const range = parseDateRange(params);
  const orders = await prisma.order.findMany({
    where: {
      createdAt: createdAtFilter(range),
      status: { in: PAID_STATUSES },
    },
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
  const range = parseDateRange(params);
  const limit = params.limit ?? 20;

  const lines = await prisma.orderLine.findMany({
    where: {
      order: {
        createdAt: createdAtFilter(range),
        status: { in: PAID_STATUSES },
      },
    },
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
 * Revenue grouped by category.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} params
 */
export async function getSalesByCategory(params = {}) {
  const range = parseDateRange(params);
  const limit = params.limit ?? 20;

  const lines = await prisma.orderLine.findMany({
    where: {
      order: {
        createdAt: createdAtFilter(range),
        status: { in: PAID_STATUSES },
      },
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

  const titles =
    categoryIds.length > 0
      ? await prisma.translation.findMany({
          where: {
            entityType: 'category',
            entityId: { in: categoryIds },
            locale: 'en',
            field: 'title',
          },
          select: { entityId: true, value: true },
        })
      : [];

  const titleById = new Map(titles.map((t) => [t.entityId, t.value]));

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
 * Full dashboard report payload.
 *
 * @param {{ startDate?: string, endDate?: string }} params
 */
export async function getDashboardReport(params = {}) {
  const [overview, salesOverTime, salesByProduct, salesByCategory] =
    await Promise.all([
      getOverviewMetrics(params),
      getSalesOverTime(params),
      getSalesByProduct(params),
      getSalesByCategory(params),
    ]);

  return { overview, salesOverTime, salesByProduct, salesByCategory };
}
