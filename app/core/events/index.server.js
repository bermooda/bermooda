// app/core/events/index.server.js
// In-process domain event bus. No external broker required.

import logger from '#/utils/logger.server';
import { beforeHookKey } from '#/core/events/names/index';

/** @type {Map<string, Function[]>} */
const handlers = new Map();

/**
 * Distinguished veto error. Not an operational error — a business decision.
 */
export class HookAbortError extends Error {
  /**
   * @param {string} reason
   * @param {{ code?: string, pluginId?: string | null }} [opts]
   */
  constructor(reason, { code = 'HOOK_BLOCKED', pluginId = null } = {}) {
    super(reason);
    this.name = 'HookAbortError';
    this.code = code;
    this.reason = reason;
    this.pluginId = pluginId;
    this.blocked = true;
  }
}

/** Throw a veto. Ergonomic sugar for plugin authors. */
export function deny(reason, opts) {
  throw new HookAbortError(reason, opts);
}

/** Type guard for route/core catch blocks. */
export function isHookAbort(err) {
  return err instanceof HookAbortError || err?.blocked === true;
}

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
 * Run all before-filters for a domain action. Dispatches to handlers
 * registered under `before.<event>` in registration order.
 *
 * Fail-closed veto semantics: if any handler throws, dispatch stops and the
 * error propagates to the caller (the domain function), which MUST NOT have
 * started its DB transaction yet.
 *
 * @param {string} event Bare action name WITHOUT the `before.` prefix.
 * @param {object} payload Context for the decision (never mutated in MVP).
 * @returns {Promise<object>} the payload (reserved for future transform phase).
 * @throws {HookAbortError} when a filter vetoes the action.
 */
export async function emitBefore(event, payload) {
  const key = beforeHookKey(event);
  const eventHandlers = handlers.get(key) ?? [];

  for (const handler of eventHandlers) {
    try {
      await handler(payload);
    } catch (err) {
      if (isHookAbort(err)) {
        logger.warn(
          {
            event: key,
            code: err.code,
            pluginId: err.pluginId,
            reason: err.reason,
          },
          'action blocked by before-hook'
        );

        await emit('hook.blocked', {
          event: key,
          code: err.code,
          pluginId: err.pluginId,
          reason: err.reason,
          orderId: payload?.orderId ?? null,
        });
      } else {
        logger.error(
          { err, event: key },
          'before-hook handler error — aborting action'
        );
      }
      throw err;
    }
  }

  return payload;
}

/**
 * Dispatch payload to all registered handlers for an event.
 *
 * Handlers are awaited in registration order.
 *
 * Error isolation:
 * - Post-hook errors are caught, logged, and remaining handlers continue
 *   executing.
 *
 * @param {string} event - The event name
 * @param {*} payload - The event payload
 */
export async function emit(event, payload) {
  const eventHandlers = handlers.get(event) ?? [];

  for (const handler of eventHandlers) {
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

// Exported for introspection / testing only.
export { handlers as _handlers };
