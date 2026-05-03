import Queue from '@sturmfrei/litequu';

import logger from '#/utils/logger.server';

const queue = new Queue({
  dbPath: process.env.QUEUE_DATABASE_PATH,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, waiting for jobs to complete...');
  await queue.close();
  process.exit(0);
});

/**
 * Map to track throttling timestamps by key
 * @type {Map<string, number>}
 */
const throttleMap = new Map();

/**
 * Creates a throttled version of a queue function
 * @param {Function} fn - The function to throttle
 * @param {Function} keyExtractor - Extract throttle key from arguments
 * @param {number} duration - Throttle duration in milliseconds
 * @returns {Function} Throttled function
 */
export function createThrottledJob(fn, keyExtractor, duration) {
  return function (...args) {
    const key = keyExtractor(...args);
    const now = Date.now();
    const lastCalled = throttleMap.get(key);

    // Check if function was called within the throttle duration
    if (lastCalled && now - lastCalled < duration) {
      return;
    }

    // Call the original function and update throttle map
    fn(...args);
    throttleMap.set(key, now);

    // Clean up old entries after throttle duration to prevent memory leaks
    setTimeout(() => {
      const current = throttleMap.get(key);
      if (current === now) {
        throttleMap.delete(key);
      }
    }, duration);
  };
}

export default queue;
