// app/core/events/names/index.js
// Canonical domain event names and before-hook helpers.

/** Wildcard for webhook subscriptions that receive every public domain event. */
export const DOMAIN_EVENT_WILDCARD = '*';

/**
 * Public domain events fanned out to webhooks, audit log, and admin pickers.
 * Internal-only events (cart churn, hook.blocked, inventory.restocked, etc.)
 * are intentionally excluded.
 */
export const DOMAIN_EVENTS = [
  'order.created',
  'order.confirmed',
  'order.updated',
  'order.fulfilled',
  'order.cancelled',
  'order.returned',
  'checkout.completed',
  'shipment.created',
  'shipment.shipped',
  'shipment.delivered',
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'customer.registered',
  'product.created',
  'product.updated',
  'product.deleted',
  'return.requested',
  'return.approved',
  'return.received',
  'return.completed',
  'return.cancelled',
];

/** Bare action names for `emitBefore` / plugin `before.*` hooks. */
export const BEFORE_HOOK_ACTIONS = [
  'checkout.advance',
  'order.place',
  'order.cancel',
  'shipment.create',
  'shipment.ship',
  'shipment.deliver',
  'refund.create',
];

export const BEFORE_HOOK_PREFIX = 'before.';

const DOMAIN_EVENT_SET = new Set(DOMAIN_EVENTS);
const BEFORE_HOOK_ACTION_SET = new Set(BEFORE_HOOK_ACTIONS);

/**
 * @param {string} event
 * @returns {boolean}
 */
export function isDomainEvent(event) {
  return DOMAIN_EVENT_SET.has(event);
}

/**
 * @param {string} event
 * @returns {boolean}
 */
export function isDomainEventOrWildcard(event) {
  return event === DOMAIN_EVENT_WILDCARD || isDomainEvent(event);
}

/**
 * @param {string} action Bare action name without the `before.` prefix.
 * @returns {string}
 */
export function beforeHookKey(action) {
  return `${BEFORE_HOOK_PREFIX}${action}`;
}

/**
 * @param {string} event Full event name (e.g. `before.shipment.create`).
 * @returns {boolean}
 */
export function isBeforeHookEvent(event) {
  return typeof event === 'string' && event.startsWith(BEFORE_HOOK_PREFIX);
}

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isBeforeHookAction(action) {
  return BEFORE_HOOK_ACTION_SET.has(action);
}
