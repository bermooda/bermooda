// app/core/exports/job.server.js
// LiteQuu worker for scheduled CSV exports.

import logger from '#/utils/logger.server';
import { handleError } from '#/libs/error.server';
import queue from '#/libs/queue.server';
import {
  runScheduledExport,
  setExportJobEnqueuer,
} from '#/core/exports/index.server';

const scheduledExportJob = queue.createJob('scheduled_export');

scheduledExportJob.process(async (taskData) => {
  const { scheduledExportId } = taskData;
  const result = await runScheduledExport(scheduledExportId);
  logger.info(
    { scheduledExportId, runId: result.runId, rowCount: result.rowCount },
    'Scheduled export completed'
  );
});

scheduledExportJob.on('failed', async (event) => {
  handleError(event.error, {
    message: 'Scheduled export job failed',
    source: 'core/exports/job.server scheduledExportJob',
  });
});

/**
 * Queue a scheduled export run.
 * @param {{ scheduledExportId: string }} taskData
 */
export function queueScheduledExportJob(taskData) {
  logger.info(
    { scheduledExportId: taskData.scheduledExportId },
    'Queueing scheduled export'
  );
  scheduledExportJob.add(taskData);
}

setExportJobEnqueuer(queueScheduledExportJob);
