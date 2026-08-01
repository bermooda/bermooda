// app/core/marketing/job.server.js
// Scheduled marketing automation worker.
// Callers import queueAbandonedCartSequence from this module.

import logger from '#/utils/logger.server';
import { defineQueueJob } from '#/libs/queue.server';
import { processAbandonedCarts } from '#/core/marketing/index.server';

const abandonedCartSequenceJob = defineQueueJob('abandoned_cart_sequence', {
  process: async () => {
    const result = await processAbandonedCarts();
    logger.info(result, 'Abandoned cart sequence processed');
  },
  onFailed: {
    message: 'Abandoned cart sequence job failed',
    source: 'core/marketing/job.server abandonedCartSequenceJob',
  },
});

/**
 * Queue abandoned-cart sequence processing.
 *
 * @returns {void}
 */
export function queueAbandonedCartSequence() {
  abandonedCartSequenceJob.add({});
}
