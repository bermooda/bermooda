import Queue from '@sturmfrei/litequu';

import logger from '#/utils/logger.server';
import { handleError } from '#/libs/error/index.server';

const queue = new Queue({
  dbPath: process.env.QUEUE_DATABASE_PATH,
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, waiting for jobs to complete...');
  await queue.close();
  process.exit(0);
});

/**
 * Create a LiteQuu job with a processor and standardized failure alerting.
 * Uses the global queue singleton.
 *
 * @param {string} name
 * @param {{
 *   process: (taskData: unknown) => Promise<void>|void,
 *   onFailed: { message: string, source: string },
 * }} options
 * @returns {ReturnType<typeof queue.createJob>}
 */
export function defineQueueJob(name, { process, onFailed }) {
  const job = queue.createJob(name);
  job.process(process);
  job.on('failed', async (/** @type {{ error: unknown }} */ event) => {
    handleError(event.error, onFailed);
  });
  return job;
}

export default queue;
