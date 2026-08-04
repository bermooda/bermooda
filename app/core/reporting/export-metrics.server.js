// app/core/reporting/export-metrics.server.js
// Scheduled export health metrics for reporting.

import prisma from '#/libs/prisma.server';
import {
  DEFAULT_REPORT_LIMIT,
  MAX_REPORT_LIMIT,
  parseDateRange,
  buildCreatedAtFilter,
} from '#/core/reporting/shared.server';

/**
 * Scheduled export health metrics.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} [params]
 * @returns {Promise<{
 *   range: { start: string, end: string },
 *   schedules: Array<{ exportType: string, schedule: string, count: number }>,
 *   recentRuns: Array<{
 *     id: string,
 *     scheduledExportId: string | null,
 *     exportType: string,
 *     status: string,
 *     rowCount: number | null,
 *     error: string | null,
 *     createdAt: string,
 *     completedAt: string | null,
 *     hasFileContent: boolean,
 *   }>,
 *   failureRate: { total: number, failed: number, rate: number },
 * }>}
 */
export async function getExportMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = buildCreatedAtFilter(range);
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );

  const [grouped, recentRuns, total, failed] = await Promise.all([
    prisma.scheduledExport.groupBy({
      by: ['exportType', 'schedule'],
      _count: { _all: true },
    }),
    prisma.exportRun.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scheduledExportId: true,
        exportType: true,
        status: true,
        rowCount: true,
        error: true,
        createdAt: true,
        completedAt: true,
        fileContent: true,
      },
    }),
    prisma.exportRun.count({ where: { createdAt: dateFilter } }),
    prisma.exportRun.count({
      where: { createdAt: dateFilter, status: 'failed' },
    }),
  ]);

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    schedules: grouped.map((row) => ({
      exportType: row.exportType,
      schedule: row.schedule,
      count: row._count._all,
    })),
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      scheduledExportId: run.scheduledExportId,
      exportType: run.exportType,
      status: run.status,
      rowCount: run.rowCount,
      error: run.error,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      hasFileContent: Boolean(run.fileContent),
    })),
    failureRate: {
      total,
      failed,
      rate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
    },
  };
}
