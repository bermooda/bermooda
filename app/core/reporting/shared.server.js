// app/core/reporting/shared.server.js
// Shared constants and query helpers for reporting.

import { DEFAULT_LOCALE } from '#/core/i18n/locales';

export const PAID_ORDER_STATUSES = ['paid', 'fulfilled', 'refunded'];

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
export function buildPaidOrderLineWhere(params = {}) {
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
