// app/core/exports/scheduled.server.js
// Scheduled export CRUD and run orchestration.

import prisma from '#/libs/prisma.server';
import { buildPrismaPagination } from '#/libs/prisma/pagination/index.server';
import {
  parseCreateScheduledExportInput,
  serializeScheduledExport,
} from '#/core/exports/csv.server';
import { generateExport } from '#/core/exports/generators.server';

const DEFAULT_LIST_LIMIT = 50;
const RECENT_RUNS_LIMIT = 3;

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
