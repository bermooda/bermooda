// app/core/marketing/job.server.js
// Scheduled marketing automation worker.

import logger from '#/utils/logger.server';
import queue, { defineQueueJob } from '#/libs/queue.server';
import {
  processAbandonedCarts,
  setAbandonedCartSequenceJobEnqueuer,
} from '#/core/marketing/index.server';

const abandonedCartSequenceJob = defineQueueJob(
  queue,
  'abandoned_cart_sequence',
  {
    process: async () => {
      const result = await processAbandonedCarts();
      logger.info(result, 'Abandoned cart sequence processed');
    },
    onFailed: {
      message: 'Abandoned cart sequence job failed',
      source: 'core/marketing/job.server abandonedCartSequenceJob',
    },
  }
);

/**
 * Queue abandoned-cart sequence processing.
 */
export function queueAbandonedCartSequenceJob() {
  abandonedCartSequenceJob.add({});
}

setAbandonedCartSequenceJobEnqueuer(queueAbandonedCartSequenceJob);
