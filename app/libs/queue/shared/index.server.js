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

/** Reset throttle state. Test use only — never call in production. */
export function __resetThrottleMap() {
  throttleMap.clear();
}
