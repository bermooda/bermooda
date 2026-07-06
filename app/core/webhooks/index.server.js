// app/core/webhooks/index.server.js
// Outbound webhook subscription management and event fan-out.
// Delivery is handled by the LiteQuu job in webhooks/job.server.js.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

// All domain events fanned out to webhook subscribers.
export const WEBHOOK_EVENTS = [
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

export const WEBHOOK_WILDCARD = '*';
const MAX_LIST_RESULTS = 100;
const SUPPORTED_EVENT_SET = new Set(WEBHOOK_EVENTS);

// Enqueuer set by job.server.js to avoid a circular import.
let _enqueuer = null;

/**
 * Register the job enqueuer. Called by job.server.js on module load.
 * @param {Function} fn - receives { deliveryId }
 */
export function setWebhookJobEnqueuer(fn) {
  _enqueuer = fn;
}

// ---------------------------------------------------------------------------
// Input + matching helpers
// ---------------------------------------------------------------------------

/**
 * Parse subscription events from a JSON string or array.
 *
 * @param {string|string[]|null|undefined} raw
 * @returns {string[]}
 */
export function parseSubscriptionEvents(raw) {
  if (Array.isArray(raw)) {
    return raw.map((event) => event.toString().trim()).filter(Boolean);
  }

  if (typeof raw === 'string' && raw.trim()) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw Object.assign(new Error('events must be an array'), {
        code: 'EVENTS_INVALID',
      });
    }
    return parsed.map((event) => event.toString().trim()).filter(Boolean);
  }

  return [];
}

/**
 * Validate webhook event names against supported domain events.
 *
 * @param {string[]} events
 */
export function validateSubscriptionEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    throw Object.assign(new Error('events must be a non-empty array'), {
      code: 'EVENTS_REQUIRED',
    });
  }

  const invalid = events.filter(
    (event) => event !== WEBHOOK_WILDCARD && !SUPPORTED_EVENT_SET.has(event)
  );
  if (invalid.length > 0) {
    throw Object.assign(
      new Error(`Unsupported webhook events: ${invalid.join(', ')}`),
      { code: 'EVENTS_INVALID' }
    );
  }
}

/**
 * Parse admin/API create payload into normalized subscription fields.
 *
 * @param {object} input
 * @returns {{ url: string, events: string[], secret: string, label: string|null }}
 */
export function parseCreateSubscriptionInput(input = {}) {
  const url = input.url?.toString().trim() ?? '';
  const secret = input.secret?.toString().trim() ?? '';
  const label = input.label?.toString().trim() || null;
  const events = parseSubscriptionEvents(input.events);

  if (!url) {
    throw Object.assign(new Error('url is required'), { code: 'URL_REQUIRED' });
  }

  if (!secret) {
    throw Object.assign(new Error('secret is required'), {
      code: 'SECRET_REQUIRED',
    });
  }

  validateSubscriptionEvents(events);

  return { url, events, secret, label };
}

/**
 * Parse admin/API update payload into normalized subscription fields.
 *
 * @param {object} input
 * @returns {{ active?: boolean, label?: string|null, url?: string, events?: string[], secret?: string }}
 */
export function parseUpdateSubscriptionInput(input = {}) {
  const parsed = {};

  if ('active' in input) {
    parsed.active =
      input.active === true || input.active === 'on' || input.active === 'true';
  }

  if ('label' in input) {
    parsed.label = input.label?.toString().trim() || null;
  }

  if ('url' in input) {
    const url = input.url?.toString().trim() ?? '';
    if (!url) {
      throw Object.assign(new Error('url is required'), {
        code: 'URL_REQUIRED',
      });
    }
    parsed.url = url;
  }

  if ('secret' in input) {
    const secret = input.secret?.toString().trim() ?? '';
    if (!secret) {
      throw Object.assign(new Error('secret is required'), {
        code: 'SECRET_REQUIRED',
      });
    }
    parsed.secret = secret;
  }

  if ('events' in input) {
    const events = parseSubscriptionEvents(input.events);
    validateSubscriptionEvents(events);
    parsed.events = events;
  }

  return parsed;
}

/**
 * Whether a subscription listens for a domain event.
 *
 * @param {string[]} subEvents
 * @param {string} eventName
 * @returns {boolean}
 */
export function subscriptionMatchesEvent(subEvents, eventName) {
  return subEvents.includes(WEBHOOK_WILDCARD) || subEvents.includes(eventName);
}

/**
 * Build the JSON payload POSTed to webhook endpoints.
 *
 * @param {string} event
 * @param {object} payload
 * @returns {string}
 */
export function buildWebhookDispatchPayload(event, payload) {
  return JSON.stringify({
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Subscription CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new webhook subscription.
 *
 * @param {{ url: string, events: string[], secret: string, label?: string }} params
 * @returns {Promise<object>}
 */
export async function createSubscription(params) {
  const { url, events, secret, label } = parseCreateSubscriptionInput(params);

  const sub = await prisma.webhookSubscription.create({
    data: {
      url,
      events: JSON.stringify(events),
      secret,
      label,
      active: true,
    },
  });

  logger.info(
    { id: sub.id, url: sub.url, events },
    'Webhook subscription created'
  );
  return serializeSubscription(sub);
}

/**
 * List webhook subscriptions with pagination.
 *
 * @param {{ page?: number, limit?: number }} [opts]
 * @returns {Promise<{ subscriptions: object[], total: number, page: number, limit: number }>}
 */
export async function listSubscriptions({ page = 1, limit = 50 } = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIST_RESULTS);
  const skip = (safePage - 1) * safeLimit;

  const [subs, total] = await Promise.all([
    prisma.webhookSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.webhookSubscription.count(),
  ]);

  return {
    subscriptions: subs.map(serializeSubscription),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Get a single webhook subscription by id.
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getSubscription(id) {
  const sub = await prisma.webhookSubscription.findUnique({ where: { id } });
  if (!sub) {
    throw Object.assign(new Error('Subscription not found'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }
  return serializeSubscription(sub);
}

/**
 * Update a webhook subscription.
 *
 * @param {string} id
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function updateSubscription(id, input) {
  await getSubscription(id);
  const parsed = parseUpdateSubscriptionInput(input);

  if (Object.keys(parsed).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), {
      code: 'NO_CHANGES',
    });
  }

  const data = { ...parsed };
  if (parsed.events) {
    data.events = JSON.stringify(parsed.events);
  }

  const sub = await prisma.webhookSubscription.update({
    where: { id },
    data,
  });

  logger.info(
    { id, fields: Object.keys(parsed) },
    'Webhook subscription updated'
  );
  return serializeSubscription(sub);
}

/**
 * Delete a webhook subscription by id.
 * @param {string} id
 */
export async function deleteSubscription(id) {
  await getSubscription(id);
  await prisma.webhookSubscription.delete({ where: { id } });
  logger.info({ id }, 'Webhook subscription deleted');
}

/**
 * List recent deliveries for a subscription.
 * @param {string} subscriptionId
 * @param {{ limit?: number }} opts
 * @returns {Promise<object[]>}
 */
export async function listDeliveries(subscriptionId, { limit = 50 } = {}) {
  await getSubscription(subscriptionId);

  const safeLimit = Math.min(Math.max(1, limit), MAX_LIST_RESULTS);
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { subscriptionId },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  });
  return deliveries.map(serializeDelivery);
}

// ---------------------------------------------------------------------------
// Delivery dispatch
// ---------------------------------------------------------------------------

/**
 * Fan out a domain event to all active matching webhook subscriptions.
 * Creates WebhookDelivery records and enqueues delivery jobs.
 *
 * @param {string} event - domain event name
 * @param {object} payload - event payload
 */
export async function dispatchWebhookEvent(event, payload) {
  const subs = await prisma.webhookSubscription.findMany({
    where: { active: true },
  });

  const matching = subs.filter((sub) => {
    const subEvents = parseSubscriptionEvents(sub.events);
    return subscriptionMatchesEvent(subEvents, event);
  });

  if (matching.length === 0) return;

  const payloadJson = buildWebhookDispatchPayload(event, payload);

  await Promise.all(
    matching.map(async (sub) => {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          subscriptionId: sub.id,
          event,
          payload: payloadJson,
          status: 'pending',
        },
      });

      if (_enqueuer) {
        _enqueuer({ deliveryId: delivery.id });
      } else {
        logger.warn(
          { deliveryId: delivery.id },
          'Webhook job enqueuer not registered; delivery queued but will not be attempted until restart'
        );
      }
    })
  );
}

// ---------------------------------------------------------------------------
// Bootstrap subscriber registration
// ---------------------------------------------------------------------------

/**
 * Register domain-event subscribers that fan out to webhook subscriptions.
 * Call once from registerBuiltins() in bootstrap.server.js.
 *
 * @param {{ on: Function }} bus
 */
export function registerWebhookSubscribers({ on: busOn }) {
  for (const eventName of WEBHOOK_EVENTS) {
    busOn(eventName, (payload) => dispatchWebhookEvent(eventName, payload));
  }
  logger.info(
    { count: WEBHOOK_EVENTS.length },
    'Webhook subscribers registered'
  );
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializeSubscription(sub) {
  return {
    ...sub,
    events: parseSubscriptionEvents(sub.events),
    createdAt: sub.createdAt?.toISOString?.() ?? sub.createdAt,
    updatedAt: sub.updatedAt?.toISOString?.() ?? sub.updatedAt,
  };
}

function serializeDelivery(d) {
  return {
    ...d,
    createdAt: d.createdAt?.toISOString?.() ?? d.createdAt,
    updatedAt: d.updatedAt?.toISOString?.() ?? d.updatedAt,
    lastAttemptAt: d.lastAttemptAt?.toISOString?.() ?? d.lastAttemptAt,
  };
}
