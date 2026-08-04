// app/core/exports/generators.server.js
// CSV generators and download resolution for exports.

import prisma from '#/libs/prisma.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import {
  buildCsv,
  getExportRun,
  validateExportType,
} from '#/core/exports/csv.server';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';
import {
  buildCreatedAtFilter,
  parseDateRange,
} from '#/core/reporting/index.server';

/**
 * @param {{ startDate?: string, endDate?: string }} filters
 */
export async function exportOrdersCsv(filters = {}) {
  const range = parseDateRange(filters);
  const orders = await prisma.order.findMany({
    where: { createdAt: buildCreatedAtFilter(range) },
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      email: true,
      status: true,
      currency: true,
      subtotalCents: true,
      shippingCents: true,
      taxCents: true,
      discountCents: true,
      totalCents: true,
      paymentProvider: true,
      createdAt: true,
    },
  });

  const headers = [
    'order_number',
    'email',
    'status',
    'currency',
    'subtotal_cents',
    'shipping_cents',
    'tax_cents',
    'discount_cents',
    'total_cents',
    'payment_provider',
    'created_at',
  ];

  const rows = orders.map((o) => [
    o.orderNumber,
    o.email,
    o.status,
    o.currency,
    o.subtotalCents,
    o.shippingCents,
    o.taxCents,
    o.discountCents,
    o.totalCents,
    o.paymentProvider,
    o.createdAt.toISOString(),
  ]);

  return { csv: buildCsv(headers, rows), rowCount: orders.length };
}

export async function exportProductsCsv(locale = DEFAULT_LOCALE) {
  const variants = await prisma.productVariant.findMany({
    orderBy: [{ product: { position: 'asc' } }, { position: 'asc' }],
    select: {
      id: true,
      sku: true,
      inventoryCount: true,
      inventoryTracked: true,
      productId: true,
      prices: { select: { currency: true, priceCents: true } },
    },
  });

  const titleByProduct = await loadProductTitleMap(
    variants.map((variant) => variant.productId),
    locale
  );

  const headers = [
    'variant_id',
    'product_id',
    'title',
    'sku',
    'inventory_count',
    'inventory_tracked',
    'prices',
  ];

  const rows = variants.map((v) => [
    v.id,
    v.productId,
    titleByProduct.get(v.productId) ?? '',
    v.sku,
    v.inventoryCount,
    v.inventoryTracked,
    v.prices.map((p) => `${p.currency}:${p.priceCents}`).join(';'),
  ]);

  return { csv: buildCsv(headers, rows), rowCount: variants.length };
}

export async function exportCustomersCsv() {
  const customers = await prisma.customer.findMany({
    where: { erasedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      preferredLocale: true,
      createdAt: true,
    },
  });

  const headers = [
    'id',
    'email',
    'name',
    'phone',
    'preferred_locale',
    'created_at',
  ];

  const rows = customers.map((c) => [
    c.id,
    c.email,
    c.name,
    c.phone,
    c.preferredLocale,
    c.createdAt.toISOString(),
  ]);

  return { csv: buildCsv(headers, rows), rowCount: customers.length };
}

export async function exportInventoryCsv(locale = DEFAULT_LOCALE) {
  const variants = await prisma.productVariant.findMany({
    where: { inventoryTracked: true },
    orderBy: { inventoryCount: 'asc' },
    select: {
      id: true,
      sku: true,
      inventoryCount: true,
      productId: true,
    },
  });

  const titleByProduct = await loadProductTitleMap(
    variants.map((variant) => variant.productId),
    locale
  );

  const headers = [
    'variant_id',
    'product_id',
    'title',
    'sku',
    'inventory_count',
  ];
  const rows = variants.map((v) => [
    v.id,
    v.productId,
    titleByProduct.get(v.productId) ?? '',
    v.sku,
    v.inventoryCount,
  ]);

  return { csv: buildCsv(headers, rows), rowCount: variants.length };
}

/**
 * Generate CSV for the given export type.
 *
 * @param {string} exportType
 * @param {object} [filters]
 */
export async function generateExport(exportType, filters = {}) {
  validateExportType(exportType);

  switch (exportType) {
    case 'orders':
      return exportOrdersCsv(filters);
    case 'products':
      return exportProductsCsv(filters.locale);
    case 'customers':
      return exportCustomersCsv();
    case 'inventory':
      return exportInventoryCsv(filters.locale);
    default:
      throw Object.assign(new Error(`Unknown export type: ${exportType}`), {
        code: 'INVALID_EXPORT_TYPE',
      });
  }
}

/**
 * Resolve CSV download payload for admin export route.
 *
 * @param {{ runId?: string, type?: string, startDate?: string, endDate?: string }} params
 */
export async function resolveExportDownload({
  runId,
  type,
  startDate,
  endDate,
} = {}) {
  if (runId) {
    const run = await getExportRun(runId, { includeFileContent: true });
    if (run.status !== 'completed' || !run.fileContent) {
      throw Object.assign(new Error('Export not found or not ready'), {
        code: 'NOT_FOUND',
        status: 404,
      });
    }

    return {
      csv: run.fileContent,
      filename: `${run.exportType}-export-${run.id}.csv`,
      rowCount: run.rowCount ?? 0,
      auditEntityId: runId,
      auditMetadata: { type: run.exportType, rowCount: run.rowCount ?? 0 },
    };
  }

  if (type) {
    const result = await generateExport(type, { startDate, endDate });
    return {
      csv: result.csv,
      filename: `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`,
      rowCount: result.rowCount,
      auditEntityId: type,
      auditMetadata: { type, rowCount: result.rowCount },
    };
  }

  throw Object.assign(new Error('Missing export type or run id'), {
    code: 'INVALID_REQUEST',
    status: 400,
  });
}
