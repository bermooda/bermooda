// app/core/audit/index.server.js
// Admin audit log: records domain events and explicit admin mutations.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { WEBHOOK_EVENTS } from '#/core/webhooks/index.server';

const ENTITY_TYPE_BY_EVENT = {
  'order.created': 'order',
  'order.confirmed': 'order',
  'order.updated': 'order',
  'order.fulfilled': 'order',
  'order.cancelled': 'order',
  'order.returned': 'order',
  'checkout.completed': 'order',
  'shipment.created': 'shipment',
  'shipment.shipped': 'shipment',
  'shipment.delivered': 'shipment',
  'payment.succeeded': 'payment',
  'payment.failed': 'payment',
  'payment.refunded': 'refund',
  'customer.registered': 'customer',
  'product.created': 'product',
  'product.updated': 'product',
  'product.deleted': 'product',
  'return.requested': 'return',
  'return.approved': 'return',
  'return.received': 'return',
  'return.completed': 'return',
  'return.cancelled': 'return',
};

/**
 * Resolve the primary entity id from a domain-event payload.
 * @param {string} event
 * @param {object} payload
 * @returns {string|undefined}
 */
function entityIdFromPayload(event, payload) {
  if (!payload || typeof payload !== 'object') return undefined;
  if (payload.orderId) return payload.orderId;
  if (payload.shipmentId) return payload.shipmentId;
  if (payload.refundId) return payload.refundId;
  if (payload.returnId) return payload.returnId;
  if (payload.productId) return payload.productId;
  if (payload.customerId) return payload.customerId;
  if (payload.id) return payload.id;
  return undefined;
}

/**
 * Persist an audit log entry.
 *
 * @param {{
 *   actorType: string,
 *   actorId?: string|null,
 *   actorEmail?: string|null,
 *   action: string,
 *   entityType?: string|null,
 *   entityId?: string|null,
 *   diff?: object|null,
 *   metadata?: object|null,
 * }} params
 * @returns {Promise<object>}
 */
export async function recordAuditLog({
  actorType,
  actorId = null,
  actorEmail = null,
  action,
  entityType = null,
  entityId = null,
  diff = null,
  metadata = null,
}) {
  const entry = await prisma.auditLog.create({
    data: {
      actorType,
      actorId,
      actorEmail,
      action,
      entityType,
      entityId,
      diffJson: diff ? JSON.stringify(diff) : null,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
  });

  logger.info(
    { auditId: entry.id, action, entityType, entityId },
    'Audit log recorded'
  );
  return serializeAuditLog(entry);
}

/**
 * Record an admin UI mutation.
 *
 * @param {{
 *   user: { id: string, email?: string|null },
 *   action: string,
 *   entityType?: string|null,
 *   entityId?: string|null,
 *   diff?: object|null,
 *   metadata?: object|null,
 * }} params
 */
export async function recordAdminAudit({
  user,
  action,
  entityType = null,
  entityId = null,
  diff = null,
  metadata = null,
}) {
  return recordAuditLog({
    actorType: 'admin',
    actorId: user.id,
    actorEmail: user.email ?? null,
    action,
    entityType,
    entityId,
    diff,
    metadata,
  });
}

/**
 * List audit log entries with optional filters.
 *
 * @param {{
 *   page?: number,
 *   limit?: number,
 *   action?: string,
 *   entityType?: string,
 *   actorId?: string,
 * }} options
 */
export async function listAuditLogs({
  page = 1,
  limit = 50,
  action,
  entityType,
  actorId,
} = {}) {
  const skip = (page - 1) * limit;
  const where = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (actorId) where.actorId = actorId;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: items.map(serializeAuditLog),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Subscribe to domain events and write system audit entries.
 *
 * @param {{ on: Function }} bus
 */
export function registerAuditSubscribers({ on }) {
  for (const event of WEBHOOK_EVENTS) {
    on(event, async (payload) => {
      await recordAuditLog({
        actorType: 'system',
        action: event,
        entityType: ENTITY_TYPE_BY_EVENT[event] ?? null,
        entityId: entityIdFromPayload(event, payload),
        metadata: payload ?? null,
      });
    });
  }
}

function serializeAuditLog(entry) {
  return {
    id: entry.id,
    actorType: entry.actorType,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    diff: entry.diffJson ? JSON.parse(entry.diffJson) : null,
    metadata: entry.metadataJson ? JSON.parse(entry.metadataJson) : null,
    createdAt: entry.createdAt.toISOString(),
  };
}
