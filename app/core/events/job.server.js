import logger from '#/utils/logger.server';
import queue, { defineQueueJob } from '#/libs/queue.server';
import {
  dispatchHandlers,
  setEventJobEnqueuer,
} from '#/core/events/index.server';

const domainEventJob = defineQueueJob(queue, 'domain_event', {
  /**
   * @param {unknown} taskData
   * @returns {Promise<void>}
   */
  process: async (taskData) => {
    if (!taskData || typeof taskData !== 'object') {
      logger.warn(
        { taskData },
        'domain_event job missing event name; skipping'
      );
      return;
    }

    const { event, payload } =
      /** @type {{ event?: unknown, payload?: unknown }} */ (taskData);
    if (!event || typeof event !== 'string') {
      logger.warn(
        { taskData },
        'domain_event job missing event name; skipping'
      );
      return;
    }
    dispatchHandlers(event, payload);
  },
  onFailed: {
    message: 'Domain event job failed',
    source: 'core/events/job.server domainEventJob',
  },
});

/**
 * Queue a domain event for async post-hook dispatch.
 *
 * @param {string} event
 * @param {unknown} payload
 * @returns {void}
 */
export function queueDomainEvent(event, payload) {
  logger.info({ event }, 'Queueing domain event');
  domainEventJob.add({ event, payload });
}

setEventJobEnqueuer(queueDomainEvent);
