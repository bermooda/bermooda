// app/core/events/index.server.js
// In-process domain event bus. No external broker required.

import logger from '#/utils/logger.server';
import { beforeHookKey } from '#/core/events/names';

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

/**
 * Throw a veto. Ergonomic sugar for plugin authors.
 *
 * @param {string} reason
 * @param {{ code?: string, pluginId?: string | null }} [opts]
 * @returns {never}
 */
export function deny(reason, opts) {
  throw new HookAbortError(reason, opts);
}

/**
 * Type guard for route/core catch blocks.
 *
 * @param {unknown} err
 * @returns {err is HookAbortError | { blocked: true, code?: string, pluginId?: string | null, reason?: string }}
 */
export function isHookAbort(err) {
  return (
    err instanceof HookAbortError ||
    (typeof err === 'object' &&
      err !== null &&
      /** @type {{ blocked?: unknown }} */ (err).blocked === true)
  );
}

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
 * Pick which failure to rethrow after parallel before-hooks settle.
 * Prefers the first-registered HookAbortError; otherwise the first-registered error.
 *
 * @param {Array<{ index: number, err: unknown }>} failures
 * @returns {unknown}
 */
function preferBeforeHookError(failures) {
  const abort = failures.find((f) => isHookAbort(f.err));
  return (abort ?? failures[0]).err;
}

/**
 * Run all before-filters for a domain action. Dispatches to handlers
 * registered under `before.<event>` in parallel.
 *
 * Fail-closed veto semantics: every handler is started; after all settle, if
 * any threw, an error propagates to the caller (the domain function), which
 * MUST NOT have started its DB transaction yet. When multiple handlers fail,
 * the first-registered HookAbortError wins; otherwise the first-registered
 * error wins.
 *
 * @param {string} event Bare action name WITHOUT the `before.` prefix.
 * @param {{ orderId?: string | null } & Record<string, unknown>} payload Context for the decision (never mutated in MVP).
 * @returns {Promise<{ orderId?: string | null } & Record<string, unknown>>} the payload (reserved for future transform phase).
 * @throws {HookAbortError} when a filter vetoes the action.
 */
export async function emitBefore(event, payload) {
  const key = beforeHookKey(event);
  const eventHandlers = handlers.get(key) ?? [];

  if (eventHandlers.length === 0) {
    return payload;
  }

  const results = await Promise.allSettled(
    eventHandlers.map(async (handler) => handler(payload))
  );

  /** @type {Array<{ index: number, err: unknown }>} */
  const failures = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') continue;

    const err = result.reason;
    failures.push({ index: i, err });

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

      emit('hook.blocked', {
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
  }

  if (failures.length > 0) {
    throw preferBeforeHookError(failures);
  }

  return payload;
}

/**
 * Dispatch payload to all registered handlers for an event.
 *
 * Fire-and-forget: returns immediately. Handlers run in parallel in the
 * background. Errors are logged per handler; remaining handlers still run.
 *
 * @param {string} event - The event name
 * @param {*} payload - The event payload
 * @returns {void}
 */
export function emit(event, payload) {
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

// Exported for introspection / testing only.
export { handlers as _handlers };
