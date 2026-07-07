// app/core/exports/index.server.js
// CSV data exports and scheduled export management.

import prisma from '#/libs/prisma.server';
import { buildPrismaPagination } from '#/libs/prisma/pagination.server';
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';
import {
  buildCreatedAtFilter,
  parseDateRange,
} from '#/core/reporting/index.server';

export const EXPORT_TYPES = ['orders', 'products', 'customers', 'inventory'];
export const EXPORT_SCHEDULES = ['daily', 'weekly', 'monthly'];

const DEFAULT_LIST_LIMIT = 50;
const RECENT_RUNS_LIMIT = 3;

// Enqueuer set by job.server.js to avoid circular imports.
let _enqueuer = null;

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

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
 * Parse a single CSV line into cell values.
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Parse CSV text into headers and row arrays.
 *
 * @param {string} text
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).filter(Boolean).map(parseCsvLine);
  return { headers, rows };
}

/**
 * Map a CSV row array to an object keyed by header names.
 *
 * @param {string[]} headers
 * @param {string[]} row
 * @returns {Record<string, string>}
 */
export function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? '';
  });
  return obj;
}

// ---------------------------------------------------------------------------
// Input + validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate an export type.
 * @param {string} exportType
 */
export function validateExportType(exportType) {
  if (!EXPORT_TYPES.includes(exportType)) {
    throw Object.assign(new Error('Invalid export type'), {
      code: 'INVALID_EXPORT_TYPE',
    });
  }
}

/**
 * Validate an export schedule.
 * @param {string} schedule
 */
export function validateExportSchedule(schedule) {
  if (!EXPORT_SCHEDULES.includes(schedule)) {
    throw Object.assign(new Error('Invalid schedule'), {
      code: 'INVALID_SCHEDULE',
    });
  }
}

/**
 * Parse export download query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {{ runId?: string, type?: string, startDate?: string, endDate?: string }}
 */
export function parseExportDownloadParams(source = {}) {
  const get = (key) => {
    if (source instanceof URLSearchParams) {
      const value = source.get(key);
      return value === null || value === '' ? undefined : value;
    }
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    return value.toString();
  };

  const runId = get('runId')?.trim();
  const type = get('type')?.trim();
  const startDate = get('startDate')?.trim();
  const endDate = get('endDate')?.trim();

  return {
    ...(runId ? { runId } : {}),
    ...(type ? { type } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

/**
 * Parse admin/API create payload into normalized scheduled export fields.
 *
 * @param {object} input
 * @returns {{ label: string, exportType: string, schedule: string, filters: object|null, recipientEmail: string|null }}
 */
export function parseCreateScheduledExportInput(input = {}) {
  const label = input.label?.toString().trim() ?? '';
  const exportType = input.exportType?.toString().trim() ?? '';
  const schedule = input.schedule?.toString().trim() ?? '';
  const recipientEmail = input.recipientEmail?.toString().trim() || null;

  if (!label || !exportType || !schedule) {
    throw Object.assign(
      new Error('Label, export type, and schedule are required'),
      { code: 'FIELDS_REQUIRED' }
    );
  }

  validateExportType(exportType);
  validateExportSchedule(schedule);

  let filters = null;
  if (input.filters !== undefined && input.filters !== null) {
    if (typeof input.filters === 'string' && input.filters.trim()) {
      filters = JSON.parse(input.filters);
    } else if (typeof input.filters === 'object') {
      filters = input.filters;
    }
  }

  return { label, exportType, schedule, filters, recipientEmail };
}

/**
 * Serialize an export run for admin/API responses.
 *
 * @param {object} run
 * @param {{ includeFileContent?: boolean }} [opts]
 */
export function serializeExportRun(run, { includeFileContent = false } = {}) {
  const serialized = {
    id: run.id,
    scheduledExportId: run.scheduledExportId,
    exportType: run.exportType,
    status: run.status,
    rowCount: run.rowCount,
    error: run.error,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };

  if (includeFileContent && run.fileContent) {
    serialized.fileContent = run.fileContent;
  } else {
    serialized.hasFileContent = Boolean(run.fileContent);
  }

  return serialized;
}

/**
 * Serialize a scheduled export for admin/API responses.
 *
 * @param {object} scheduledExport
 * @param {{ includeFileContent?: boolean }} [opts]
 */
export function serializeScheduledExport(
  scheduledExport,
  { includeFileContent = false } = {}
) {
  return {
    id: scheduledExport.id,
    label: scheduledExport.label,
    exportType: scheduledExport.exportType,
    schedule: scheduledExport.schedule,
    filtersJson: scheduledExport.filtersJson,
    recipientEmail: scheduledExport.recipientEmail,
    active: scheduledExport.active,
    lastRunAt: scheduledExport.lastRunAt?.toISOString() ?? null,
    createdAt: scheduledExport.createdAt.toISOString(),
    updatedAt: scheduledExport.updatedAt.toISOString(),
    runs: scheduledExport.runs?.map((run) =>
      serializeExportRun(run, { includeFileContent })
    ),
  };
}

// ---------------------------------------------------------------------------
// CSV generators
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scheduled export CRUD
// ---------------------------------------------------------------------------

/**
 * Create a scheduled export definition.
 */
export async function createScheduledExport(input) {
  const { label, exportType, schedule, filters, recipientEmail } =
    parseCreateScheduledExportInput(input);

  const created = await prisma.scheduledExport.create({
    data: {
      label,
      exportType,
      schedule,
      filtersJson: filters ? JSON.stringify(filters) : null,
      recipientEmail,
      active: true,
    },
  });

  return serializeScheduledExport(created);
}

/**
 * List scheduled exports with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 * @returns {Promise<{ scheduledExports: object[], total: number, page: number, limit: number }>}
 */
export async function listScheduledExports({
  page = 1,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page,
    limit,
    defaultLimit: DEFAULT_LIST_LIMIT,
  });

  const [items, total] = await Promise.all([
    prisma.scheduledExport.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: RECENT_RUNS_LIMIT,
        },
      },
    }),
    prisma.scheduledExport.count(),
  ]);

  return {
    scheduledExports: items.map((item) => serializeScheduledExport(item)),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Get a scheduled export by id.
 *
 * @param {string} id
 */
export async function getScheduledExport(id) {
  const scheduledExport = await prisma.scheduledExport.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: RECENT_RUNS_LIMIT,
      },
    },
  });

  if (!scheduledExport) {
    throw Object.assign(new Error('Scheduled export not found'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return serializeScheduledExport(scheduledExport);
}

/**
 * Delete a scheduled export by id.
 *
 * @param {string} id
 */
export async function deleteScheduledExport(id) {
  const existing = await prisma.scheduledExport.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error('Scheduled export not found'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  await prisma.scheduledExport.delete({ where: { id } });
  return { deleted: true };
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
 * Return export run by id.
 *
 * @param {string} runId
 * @param {{ includeFileContent?: boolean }} [opts]
 */
export async function getExportRun(runId, { includeFileContent = false } = {}) {
  const run = await prisma.exportRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw Object.assign(new Error('Export run not found'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return serializeExportRun(run, { includeFileContent });
}

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
