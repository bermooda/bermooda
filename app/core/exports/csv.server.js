// app/core/exports/csv.server.js
// CSV helpers, validation/parse helpers, and serialize helpers for exports.

import prisma from '#/libs/prisma.server';

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

/**
 * Return export run by id.
 *
 * Lives with serialize helpers (not scheduled CRUD) so generators can resolve
 * downloads without a generators ↔ scheduled import cycle.
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
