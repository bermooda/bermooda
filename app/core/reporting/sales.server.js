// app/core/reporting/sales.server.js
// Sales analytics: over-time, by product, by category.

import prisma from '#/libs/prisma.server';
import { loadCategoryTitleMap } from '#/core/catalog/translations.server';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';
import {
  DEFAULT_REPORT_LIMIT,
  MAX_REPORT_LIMIT,
  buildPaidOrderWhere,
  buildPaidOrderLineWhere,
} from '#/core/reporting/shared.server';

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
