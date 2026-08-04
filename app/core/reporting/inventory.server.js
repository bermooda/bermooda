// app/core/reporting/inventory.server.js
// Inventory snapshot analytics for reporting.

import prisma from '#/libs/prisma.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { DEFAULT_CURRENCY } from '#/core/settings/defaults';
import { get } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';
import {
  DEFAULT_REPORT_LIMIT,
  MAX_REPORT_LIMIT,
} from '#/core/reporting/shared.server';

export const LOW_STOCK_THRESHOLD = 5;

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
