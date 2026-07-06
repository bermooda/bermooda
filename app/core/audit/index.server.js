// app/core/audit/index.server.js
// Admin audit log: records domain events and explicit admin mutations.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { DOMAIN_EVENTS } from '#/core/events/names';

const MAX_LIST_RESULTS = 100;
const DEFAULT_LIST_LIMIT = 50;

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

// ---------------------------------------------------------------------------
// Input + entity helpers
// ---------------------------------------------------------------------------

/**
 * Parse audit list query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {{ page: number, limit: number, action?: string, entityType?: string, actorId?: string }}
 */
export function parseAuditListParams(source = {}) {
  const get = (key) => {
    if (source instanceof URLSearchParams) {
      const value = source.get(key);
      return value === null || value === '' ? undefined : value;
    }
    const value = source[key];
    if (value === null || value === undefined || value === '') return undefined;
    return value.toString();
  };

  const page = Math.max(1, parseInt(get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    Math.max(
      1,
      parseInt(get('limit') ?? String(DEFAULT_LIST_LIMIT), 10) ||
        DEFAULT_LIST_LIMIT
    ),
    MAX_LIST_RESULTS
  );

  const action = get('action')?.trim();
  const entityType = get('entityType')?.trim();
  const actorId = get('actorId')?.trim();

  return {
    page,
    limit,
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(actorId ? { actorId } : {}),
  };
}

/**
 * Build a Prisma where clause for audit log list filters.
 *
 * @param {{ action?: string, entityType?: string, actorId?: string }} filters
 * @returns {object}
 */
export function buildAuditLogWhere({ action, entityType, actorId } = {}) {
  const where = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (actorId) where.actorId = actorId;
  return where;
}

/**
 * Resolve entity type for a domain event.
 *
 * @param {string} event
 * @returns {string|null}
 */
export function entityTypeFromEvent(event) {
  return ENTITY_TYPE_BY_EVENT[event] ?? null;
}

/**
 * Resolve the primary entity id from a domain-event payload.
 *
 * @param {string} _event
 * @param {object} payload
 * @returns {string|undefined}
 */
export function entityIdFromPayload(_event, payload) {
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
 * Resolve audit entity fields from a domain event and payload.
 *
 * @param {string} event
 * @param {object} payload
 * @returns {{ entityType: string|null, entityId: string|undefined }}
 */
export function resolveAuditEntity(event, payload) {
  return {
    entityType: entityTypeFromEvent(event),
    entityId: entityIdFromPayload(event, payload),
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

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
 * Get a single audit log entry by id.
 *
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getAuditLog(id) {
  const entry = await prisma.auditLog.findUnique({ where: { id } });
  if (!entry) {
    throw Object.assign(new Error('Audit log entry not found'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }
  return serializeAuditLog(entry);
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
  limit = DEFAULT_LIST_LIMIT,
  action,
  entityType,
  actorId,
} = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIST_RESULTS);
  const skip = (safePage - 1) * safeLimit;
  const where = buildAuditLogWhere({ action, entityType, actorId });

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    auditLogs: items.map(serializeAuditLog),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

/**
 * Subscribe to domain events and write system audit entries.
 *
 * @param {{ on: Function }} bus
 */
export function registerAuditSubscribers({ on }) {
  for (const event of DOMAIN_EVENTS) {
    on(event, async (payload) => {
      const { entityType, entityId } = resolveAuditEntity(event, payload);
      await recordAuditLog({
        actorType: 'system',
        action: event,
        entityType,
        entityId: entityId ?? null,
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
