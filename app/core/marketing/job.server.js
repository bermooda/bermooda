// app/core/marketing/job.server.js
// Scheduled marketing automation worker.

import logger from '#/utils/logger.server';
import { handleError } from '#/libs/error.server';
import queue from '#/libs/queue.server';

import { processAbandonedCarts } from '#/core/marketing/index.server';

const abandonedCartSequenceJob = queue.createJob('abandoned_cart_sequence');

abandonedCartSequenceJob.process(async () => {
  const result = await processAbandonedCarts();
  logger.info(result, 'Abandoned cart sequence processed');
});

abandonedCartSequenceJob.on('failed', async (event) => {
  handleError(event.error, {
    message: 'Abandoned cart sequence job failed',
    source: 'core/marketing/job.server abandonedCartSequenceJob',
  });
});

/**
 * Queue abandoned-cart sequence processing.
 */
export function queueAbandonedCartSequenceJob() {
  abandonedCartSequenceJob.add({});
}
