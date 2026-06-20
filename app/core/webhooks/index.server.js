// app/core/webhooks/index.server.js
// Outbound webhook subscription management and event fan-out.
// Delivery is handled by the LiteQuu job in webhooks/job.server.js.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

// All domain events fanned out to webhook subscribers.
export const WEBHOOK_EVENTS = [
  'order.created',
  'order.confirmed',
  'order.cancelled',
  'order.returned',
  'shipment.created',
  'shipment.shipped',
  'shipment.delivered',
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'return.requested',
  'return.approved',
  'return.received',
  'return.completed',
  'return.cancelled',
];

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
// Subscription CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new webhook subscription.
 *
 * @param {{ url: string, events: string[], secret: string, label?: string }} params
 * @returns {Promise<object>}
 */
export async function createSubscription({ url, events, secret, label }) {
  if (!url?.trim()) {
    throw Object.assign(new Error('url is required'), { code: 'URL_REQUIRED' });
  }
  if (!Array.isArray(events) || events.length === 0) {
    throw Object.assign(new Error('events must be a non-empty array'), {
      code: 'EVENTS_REQUIRED',
    });
  }
  if (!secret?.trim()) {
    throw Object.assign(new Error('secret is required'), {
      code: 'SECRET_REQUIRED',
    });
  }

  const sub = await prisma.webhookSubscription.create({
    data: {
      url: url.trim(),
      events: JSON.stringify(events),
      secret,
      label: label?.trim() ?? null,
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
 * List all webhook subscriptions.
 * @returns {Promise<object[]>}
 */
export async function listSubscriptions() {
  const subs = await prisma.webhookSubscription.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return subs.map(serializeSubscription);
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
 * Delete a webhook subscription by id.
 * @param {string} id
 */
export async function deleteSubscription(id) {
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
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { subscriptionId },
    orderBy: { createdAt: 'desc' },
    take: limit,
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
    const subEvents = JSON.parse(sub.events);
    return subEvents.includes('*') || subEvents.includes(event);
  });

  if (matching.length === 0) return;

  const payloadJson = JSON.stringify({
    event,
    data: payload,
    timestamp: new Date().toISOString(),
  });

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
    events: JSON.parse(sub.events),
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
