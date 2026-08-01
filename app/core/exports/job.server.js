// app/core/exports/job.server.js
// LiteQuu worker for scheduled CSV exports.
// Callers import queueScheduledExport from this module.

import logger from '#/utils/logger.server';
import queue, { defineQueueJob } from '#/libs/queue.server';
import { runScheduledExport } from '#/core/exports/index.server';

const scheduledExportJob = defineQueueJob(queue, 'scheduled_export', {
  process: async (taskData) => {
    const { scheduledExportId } = taskData;
    const result = await runScheduledExport(scheduledExportId);
    logger.info(
      { scheduledExportId, runId: result.runId, rowCount: result.rowCount },
      'Scheduled export completed'
    );
  },
  onFailed: {
    message: 'Scheduled export job failed',
    source: 'core/exports/job.server scheduledExportJob',
  },
});

/**
 * Queue a scheduled export run.
 *
 * @param {{ scheduledExportId: string }} taskData
 * @returns {void}
 */
export function queueScheduledExport(taskData) {
  logger.info(
    { scheduledExportId: taskData.scheduledExportId },
    'Queueing scheduled export'
  );
  scheduledExportJob.add(taskData);
}
