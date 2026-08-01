// app/core/events/handlers.server.js
// In-process handler registry + sync dispatch (used by the domain_event job).

import logger from '#/utils/logger.server';

/** @type {Map<string, Function[]>} */
const handlers = new Map();

/**
 * Register a handler for a named event.
 * Handlers are called in registration order for start/scheduling;
 * parallel dispatch does not guarantee completion order.
 *
 * @param {string} event - The event name (e.g. 'order.created')
 * @param {Function} handler - Async or sync handler receiving the payload
 */
export function on(event, handler) {
  const existing = handlers.get(event);
  if (!existing) {
    handlers.set(event, [handler]);
    return;
  }
  existing.push(handler);
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
 * Run post-hook handlers for an event.
 *
 * Fire-and-forget: returns immediately. Handlers run in parallel in the
 * background. Errors are logged per handler; remaining handlers still run.
 *
 * @param {string} event
 * @param {unknown} payload
 * @returns {void}
 */
export function dispatchHandlers(event, payload) {
  const eventHandlers = handlers.get(event) ?? [];

  for (const handler of eventHandlers) {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => {
        logger.error(
          { err, event },
          `Event handler error for "${event}" — continuing dispatch`
        );
      });
  }
}

/**
 * Look up registered handlers for an event (before-hooks / tests).
 *
 * @param {string} event
 * @returns {Function[]}
 */
export function getHandlers(event) {
  return handlers.get(event) ?? [];
}

// Exported for introspection / testing only.
export { handlers as _handlers };
