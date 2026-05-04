// app/core/events/index.server.js
// In-process domain event bus. No external broker required.

import logger from '#/utils/logger.server';

/** @type {Map<string, Function[]>} */
const handlers = new Map();

/**
 * Register a handler for a named event.
 * Handlers are called in registration order.
 *
 * @param {string} event - The event name (e.g. 'order.created')
 * @param {Function} handler - Async or sync handler receiving the payload
 */
export function on(event, handler) {
  if (!handlers.has(event)) {
    handlers.set(event, []);
  }
  handlers.get(event).push(handler);
}

/**
 * Removes a previously registered handler for an event.
 * @param {string} event
 * @param {Function} handler - Must be the same function reference passed to `on`.
 */
export function off(event, handler) {
  const existing = handlers.get(event);
  if (!existing) return;
  const updated = existing.filter((h) => h !== handler);
  if (updated.length === 0) {
    handlers.delete(event);
  } else {
    handlers.set(event, updated);
  }
}

/**
 * Dispatch payload to all registered handlers for an event.
 *
 * Handlers are awaited in registration order.
 *
 * Error isolation:
 * - For non-checkout events: errors are caught, logged, and remaining
 *   handlers continue executing.
 * - For checkout.* events: errors propagate immediately (transactional path).
 *
 * @param {string} event - The event name
 * @param {*} payload - The event payload
 */
export async function emit(event, payload) {
  // ALL checkout.* events are considered transactional — errors rethrow and
  // abort dispatch. Non-transactional checkout analytics must use a different
  // namespace (e.g. analytics.*) so they receive the fault-tolerant path.
  const isCheckout = event.startsWith('checkout.');
  const eventHandlers = handlers.get(event) ?? [];

  for (const handler of eventHandlers) {
    if (isCheckout) {
      // Let checkout errors bubble up — they are transactional.
      await handler(payload);
    } else {
      try {
        await handler(payload);
      } catch (err) {
        logger.error(
          { err, event },
          `Event handler error for "${event}" — continuing dispatch`
        );
      }
    }
  }
}

// Exported for introspection / testing only.
export { handlers as _handlers };
