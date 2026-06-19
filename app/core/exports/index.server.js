// app/core/exports/index.server.js
// CSV data exports and scheduled export management.

import prisma from '#/libs/prisma.server';
import { parseDateRange } from '#/core/reporting/index.server';

export const EXPORT_TYPES = ['orders', 'products', 'customers', 'inventory'];
export const EXPORT_SCHEDULES = ['daily', 'weekly', 'monthly'];

/**
 * Escape a CSV cell value.
 * @param {unknown} value
 * @returns {string}
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from headers and rows.
 * @param {string[]} headers
 * @param {unknown[][]} rows
 * @returns {string}
 */
export function buildCsv(headers, rows) {
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ];
  return lines.join('\n');
}

/**
 * @param {{ startDate?: string, endDate?: string }} filters
 */
export async function exportOrdersCsv(filters = {}) {
  const range = parseDateRange(filters);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: range.start, lte: range.end } },
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

export async function exportProductsCsv() {
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

  const productIds = [...new Set(variants.map((v) => v.productId))];
  const titles =
    productIds.length > 0
      ? await prisma.translation.findMany({
          where: {
            entityType: 'product',
            entityId: { in: productIds },
            locale: 'en',
            field: 'title',
          },
          select: { entityId: true, value: true },
        })
      : [];
  const titleByProduct = new Map(titles.map((t) => [t.entityId, t.value]));

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

export async function exportInventoryCsv() {
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

  const productIds = [...new Set(variants.map((v) => v.productId))];
  const titles =
    productIds.length > 0
      ? await prisma.translation.findMany({
          where: {
            entityType: 'product',
            entityId: { in: productIds },
            locale: 'en',
            field: 'title',
          },
          select: { entityId: true, value: true },
        })
      : [];
  const titleByProduct = new Map(titles.map((t) => [t.entityId, t.value]));

  const headers = ['variant_id', 'product_id', 'title', 'sku', 'inventory_count'];
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
  switch (exportType) {
    case 'orders':
      return exportOrdersCsv(filters);
    case 'products':
      return exportProductsCsv();
    case 'customers':
      return exportCustomersCsv();
    case 'inventory':
      return exportInventoryCsv();
    default:
      throw Object.assign(new Error(`Unknown export type: ${exportType}`), {
        code: 'INVALID_EXPORT_TYPE',
      });
  }
}

/**
 * Create a scheduled export definition.
 */
export async function createScheduledExport({
  label,
  exportType,
  schedule,
  filters = null,
  recipientEmail = null,
}) {
  if (!EXPORT_TYPES.includes(exportType)) {
    throw Object.assign(new Error('Invalid export type'), {
      code: 'INVALID_EXPORT_TYPE',
    });
  }
  if (!EXPORT_SCHEDULES.includes(schedule)) {
    throw Object.assign(new Error('Invalid schedule'), {
      code: 'INVALID_SCHEDULE',
    });
  }

  return prisma.scheduledExport.create({
    data: {
      label: label.trim(),
      exportType,
      schedule,
      filtersJson: filters ? JSON.stringify(filters) : null,
      recipientEmail: recipientEmail?.trim() || null,
      active: true,
    },
  });
}

export async function listScheduledExports() {
  return prisma.scheduledExport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 3,
      },
    },
  });
}

export async function deleteScheduledExport(id) {
  return prisma.scheduledExport.delete({ where: { id } });
}

/**
 * Run a scheduled export: generates CSV, stores ExportRun, updates lastRunAt.
 *
 * @param {string} scheduledExportId
 */
export async function runScheduledExport(scheduledExportId) {
  const scheduled = await prisma.scheduledExport.findUnique({
    where: { id: scheduledExportId },
  });
  if (!scheduled || !scheduled.active) {
    throw Object.assign(new Error('Scheduled export not found or inactive'), {
      code: 'NOT_FOUND',
    });
  }

  const run = await prisma.exportRun.create({
    data: {
      scheduledExportId,
      exportType: scheduled.exportType,
      status: 'pending',
    },
  });

  try {
    const filters = scheduled.filtersJson
      ? JSON.parse(scheduled.filtersJson)
      : {};
    const { csv, rowCount } = await generateExport(
      scheduled.exportType,
      filters
    );

    await prisma.$transaction([
      prisma.exportRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          rowCount,
          fileContent: csv,
          completedAt: new Date(),
        },
      }),
      prisma.scheduledExport.update({
        where: { id: scheduledExportId },
        data: { lastRunAt: new Date() },
      }),
    ]);

    return { runId: run.id, rowCount };
  } catch (err) {
    await prisma.exportRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        error: err.message,
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

/**
 * Return export run CSV content for download.
 * @param {string} runId
 */
export async function getExportRun(runId) {
  return prisma.exportRun.findUnique({ where: { id: runId } });
}

// Enqueuer set by job.server.js to avoid circular imports.
let _enqueuer = null;

export function setExportJobEnqueuer(fn) {
  _enqueuer = fn;
}

/**
 * Queue a scheduled export run.
 * @param {{ scheduledExportId: string }} taskData
 */
export function queueScheduledExport(taskData) {
  if (_enqueuer) {
    _enqueuer(taskData);
  }
}
