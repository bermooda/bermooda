import { handleError } from '#/libs/error.server';

/**
 * Map to track throttling timestamps by key
 * @type {Map<string, number>}
 */
const throttleMap = new Map();

/**
 * Creates a throttled version of a queue function.
 *
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

    if (lastCalled && now - lastCalled < duration) {
      return;
    }

    fn(...args);
    throttleMap.set(key, now);

    setTimeout(() => {
      const current = throttleMap.get(key);
      if (current === now) {
        throttleMap.delete(key);
      }
    }, duration);
  };
}

/**
 * Create a LiteQuu job with a processor and standardized failure alerting.
 *
 * @param {import('@sturmfrei/litequu').Queue} queueInstance
 * @param {string} name
 * @param {{
 *   process: (taskData: unknown) => Promise<void>|void,
 *   onFailed: { message: string, source: string },
 * }} options
 */
export function defineQueueJob(queueInstance, name, { process, onFailed }) {
  const job = queueInstance.createJob(name);
  job.process(process);
  job.on('failed', async (event) => {
    handleError(event.error, onFailed);
  });
  return job;
}

/** Reset throttle state. Test use only — never call in production. */
export function __resetThrottleMap() {
  throttleMap.clear();
}
