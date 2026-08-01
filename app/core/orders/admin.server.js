// app/core/orders/admin.server.js
// Admin order list/load/serialize/status/notes/cancel helpers.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
} from '#/libs/prisma/pagination/index.server';
import { emitBefore } from '#/core/events/index.server';
import { queueEmit } from '#/core/events/job.server';
import { incrementInventory } from '#/core/inventory/index.server';
import { inventoryItemsFromLines } from '#/core/inventory/items';

const DEFAULT_ORDER_LIST_LIMIT = 20;
const MAX_ORDER_LIST_RESULTS = 100;

const VALID_ORDER_STATUSES = new Set([
  'pending',
  'pending_payment',
  'confirmed',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
]);

/** Manual admin status transitions (stricter than free-form updates). */
const ORDER_STATUS_TRANSITIONS = {
  pending: ['paid'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['fulfilled', 'cancelled'],
  fulfilled: ['cancelled', 'refunded'],
};

const ORDER_ADMIN_DETAIL_INCLUDE = {
  lines: { orderBy: { createdAt: 'asc' } },
  shipments: {
    orderBy: { createdAt: 'asc' },
    include: { lines: { include: { orderLine: true } } },
  },
  refunds: { orderBy: { createdAt: 'asc' } },
  returns: {
    orderBy: { createdAt: 'asc' },
    include: { lines: { include: { orderLine: true } } },
  },
  customer: { select: { email: true, name: true } },
};

const ORDER_ADMIN_LIST_SELECT = {
  id: true,
  orderNumber: true,
  email: true,
  status: true,
  currency: true,
  totalCents: true,
  createdAt: true,
};

/**
 * @param {string} [q]
 * @param {string} [status]
 * @param {string} [customerId]
 * @returns {object}
 */
function buildOrderListWhere({ q, status, customerId } = {}) {
  const where = {};
  if (customerId) where.customerId = customerId;
  if (status && status !== 'all') where.status = status;
  const query = q?.toString().trim();
  if (query) {
    where.OR = [
      { orderNumber: { contains: query } },
      { email: { contains: query } },
    ];
  }
  return where;
}

/**
 * Restore inventory for tracked order lines.
 * @param {Array<{ variantId?: string|null, quantity: number }>} lines
 */
async function restoreOrderLineInventory(lines = []) {
  const items = inventoryItemsFromLines(lines);
  if (items.length > 0) {
    await incrementInventory(items);
  }
}

/**
 * @param {object} order
 * @returns {object}
 */
export function serializeOrderAdminDetail(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    email: order.email,
    status: order.status,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    shippingAddressJson: order.shippingAddressJson,
    billingAddressJson: order.billingAddressJson ?? null,
    paymentProvider: order.paymentProvider ?? null,
    paymentIntentId: order.paymentIntentId ?? null,
    couponCode: order.couponCode ?? null,
    notes: order.notes ?? '',
    createdAt: order.createdAt.toISOString(),
    customer: order.customer
      ? { email: order.customer.email, name: order.customer.name ?? null }
      : null,
    lines: order.lines.map((l) => ({
      id: l.id,
      title: l.title,
      sku: l.sku ?? null,
      quantity: l.quantity,
      fulfilledQuantity: l.fulfilledQuantity ?? 0,
      returnedQuantity: l.returnedQuantity ?? 0,
      priceCents: l.priceCents,
      totalCents: l.totalCents,
    })),
    shipments: order.shipments.map((s) => ({
      id: s.id,
      status: s.status,
      carrier: s.carrier ?? null,
      trackingNumber: s.trackingNumber ?? null,
      trackingUrl: s.trackingUrl ?? null,
      shippedAt: s.shippedAt?.toISOString() ?? null,
      deliveredAt: s.deliveredAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    refunds: order.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      reason: r.reason ?? null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    returns: order.returns.map((ret) => ({
      id: ret.id,
      status: ret.status,
      reason: ret.reason ?? null,
      resolution: ret.resolution ?? null,
      storeCreditCents: ret.storeCreditCents ?? null,
      createdAt: ret.createdAt.toISOString(),
      lines: ret.lines.map((l) => ({
        id: l.id,
        orderLineId: l.orderLineId,
        title: l.orderLine?.title ?? '',
        quantity: l.quantity,
        restocked: l.restocked,
      })),
    })),
  };
}

/**
 * Fetch an order by id with lines, shipments, refunds, returns, and customer.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getOrder(id) {
  return prisma.order.findUnique({
    where: { id },
    include: ORDER_ADMIN_DETAIL_INCLUDE,
  });
}

/**
 * Fetch an order by public order number for storefront thank-you pages.
 *
 * @param {string} orderNumber
 * @returns {Promise<object|null>}
 */
export async function getOrderByOrderNumber(orderNumber) {
  const normalized = orderNumber?.toString().trim();
  if (!normalized) return null;

  return prisma.order.findFirst({
    where: { orderNumber: normalized },
    include: { lines: true },
  });
}

/**
 * List orders with lines. Newest first.
 * @param {{
 *   customerId?: string,
 *   status?: string,
 *   q?: string,
 *   page?: number,
 *   limit?: number,
 * }} options
 * @returns {Promise<{ orders: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listOrders({
  customerId,
  status,
  q,
  page = 1,
  limit = DEFAULT_ORDER_LIST_LIMIT,
} = {}) {
  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page,
    limit,
    defaultLimit: DEFAULT_ORDER_LIST_LIMIT,
    maxLimit: MAX_ORDER_LIST_RESULTS,
  });
  const where = buildOrderListWhere({ customerId, status, q });

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

/**
 * Load admin orders index data (list rows + status stats).
 *
 * @param {Request} request
 * @param {{ pageSize?: number }} [options]
 * @returns {Promise<object>}
 */
export async function loadOrdersAdminIndexData(
  request,
  { pageSize = DEFAULT_ORDER_LIST_LIMIT } = {}
) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const q = url.searchParams.get('q')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() || 'all';
  const where = buildOrderListWhere({ q, status });

  const [total, pendingCount, paidCount, fulfilledCount, orders] =
    await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({
        where: {
          ...where,
          status: { in: ['pending', 'pending_payment'] },
        },
      }),
      prisma.order.count({ where: { ...where, status: 'paid' } }),
      prisma.order.count({ where: { ...where, status: 'fulfilled' } }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: ORDER_ADMIN_LIST_SELECT,
      }),
    ]);

  return {
    rows: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      email: o.email,
      status: o.status,
      currency: o.currency,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
    })),
    total,
    pendingCount,
    paidCount,
    fulfilledCount,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    q,
    status,
  };
}

/**
 * Load serialized admin order detail, or null when missing.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function loadOrderAdminDetailData(id) {
  const order = await getOrder(id);
  if (!order) return null;
  return serializeOrderAdminDetail(order);
}

/**
 * Update an order's status. Throws for unknown status values.
 * @param {string} id
 * @param {string} status
 * @returns {Promise<object>}
 */
export async function updateOrderStatus(id, status) {
  if (!VALID_ORDER_STATUSES.has(status)) {
    throw new Error('INVALID_ORDER_STATUS');
  }

  const current = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
  });

  if (current && current.status !== status) {
    await queueEmit('order.updated', {
      orderId: id,
      previousStatus: current.status,
      status,
    });
  }

  return updated;
}

/**
 * Apply an allowed admin status transition.
 *
 * @param {string} id
 * @param {string} status
 * @returns {Promise<object>}
 */
export async function transitionOrderStatus(id, status) {
  const current = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) {
    throw Object.assign(new Error('Order not found.'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  const allowed = ORDER_STATUS_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(status)) {
    throw Object.assign(new Error('Invalid status transition.'), {
      code: 'INVALID_ORDER_STATUS_TRANSITION',
    });
  }

  return updateOrderStatus(id, status);
}

/**
 * Update merchant notes on an order.
 *
 * @param {string} id
 * @param {string} notes
 * @returns {Promise<object>}
 */
export async function updateOrderNotes(id, notes) {
  return prisma.order.update({
    where: { id },
    data: { notes: notes?.toString() ?? '' },
  });
}

/**
 * Cancel an order: restore inventory for all lines, then mark cancelled.
 * Emits 'order.cancelled'.
 *
 * @param {string} orderId
 * @returns {Promise<object>} updated Order
 */
export async function cancelOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  await emitBefore('order.cancel', { orderId, order });

  await restoreOrderLineInventory(order.lines);

  const updated = await updateOrderStatus(orderId, 'cancelled');

  await queueEmit('order.cancelled', { orderId, orderNumber: order.orderNumber });

  logger.info({ orderId, orderNumber: order.orderNumber }, 'order cancelled');

  return updated;
}
