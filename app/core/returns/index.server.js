// app/core/returns/index.server.js
// Returns/RMA service: customer and admin flows, restock on receipt.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination/index.server';
import { emit } from '#/core/events/index.server';
import { incrementInventory } from '#/core/inventory/index.server';
import { inventoryItemsFromLines } from '#/core/inventory/items';
import { createRefund } from '#/core/orders/index.server';
import { issueStoreCredit } from '#/core/store-credit/index.server';

export const RETURN_STATUSES = [
  'requested',
  'approved',
  'received',
  'refunded',
  'exchanged',
  'cancelled',
];

export const RETURN_RESOLUTIONS = ['refund', 'store_credit', 'exchange'];

export const DEFAULT_RETURN_LIST_LIMIT = 20;
export const MAX_RETURN_LIST_RESULTS = 100;

const RETURN_STATUS_SET = new Set(RETURN_STATUSES);
const RETURN_RESOLUTION_SET = new Set(RETURN_RESOLUTIONS);

const RETURN_DETAIL_INCLUDE = {
  lines: { include: { orderLine: true } },
  order: { select: { orderNumber: true, email: true, customerId: true } },
};

const RETURN_LIST_INCLUDE = {
  lines: { include: { orderLine: { select: { title: true, sku: true } } } },
  order: { select: { id: true, orderNumber: true, email: true } },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse return list query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {{ page: number, limit: number, orderId?: string, customerId?: string, status?: string }}
 */
export function parseReturnListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_RETURN_LIST_LIMIT,
    max: MAX_RETURN_LIST_RESULTS,
  });

  const orderId = readQueryParam(source, 'orderId')?.trim();
  const customerId = readQueryParam(source, 'customerId')?.trim();
  const status = readQueryParam(source, 'status')?.trim();

  if (status && !RETURN_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid return status filter.'), {
      code: 'INVALID_RETURN_STATUS',
    });
  }

  return {
    page,
    limit,
    ...(orderId ? { orderId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(status ? { status } : {}),
  };
}

/**
 * Build a Prisma where clause for return list filters.
 *
 * @param {{ orderId?: string, customerId?: string, status?: string }} filters
 */
export function buildReturnWhere({ orderId, customerId, status } = {}) {
  const where = {};
  if (orderId) where.orderId = orderId;
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  return where;
}

/**
 * Parse and normalize return line payloads.
 *
 * @param {Array<{ orderLineId: string, quantity: number }>} lines
 */
export function parseReturnLinesInput(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Object.assign(new Error('Return lines are required.'), {
      code: 'RETURN_LINES_REQUIRED',
    });
  }

  return lines.map((line) => {
    const orderLineId = line.orderLineId?.toString().trim();
    const quantity =
      typeof line.quantity === 'number'
        ? line.quantity
        : parseInt(String(line.quantity ?? '0'), 10);

    if (!orderLineId || !Number.isFinite(quantity)) {
      throw Object.assign(new Error('Invalid return line.'), {
        code: 'INVALID_RETURN_LINE',
      });
    }

    return { orderLineId, quantity };
  });
}

/**
 * Parse admin/API create payload for a return request.
 *
 * @param {object} input
 */
export function parseRequestReturnInput(input = {}) {
  const reason = input.reason?.toString().trim() || undefined;
  const lines = parseReturnLinesInput(input.lines);
  return { reason, lines };
}

/**
 * Parse return line quantities from a storefront form submission.
 *
 * @param {FormData} formData
 */
export function parseReturnLinesFromForm(formData) {
  const lines = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('qty-')) {
      const orderLineId = key.slice(4);
      const quantity = parseInt(String(value), 10);
      if (quantity > 0) {
        lines.push({ orderLineId, quantity });
      }
    }
  }
  return lines;
}

/**
 * Parse complete-return options from admin/API input.
 *
 * @param {object} input
 */
export function parseCompleteReturnInput(input = {}) {
  const resolution = input.resolution?.toString().trim() || undefined;
  const refundAmountCents =
    input.refundAmountCents == null || input.refundAmountCents === ''
      ? undefined
      : typeof input.refundAmountCents === 'number'
        ? input.refundAmountCents
        : parseInt(String(input.refundAmountCents), 10);

  if (
    refundAmountCents != null &&
    (!Number.isFinite(refundAmountCents) || refundAmountCents < 0)
  ) {
    throw Object.assign(new Error('refundAmountCents must be a number.'), {
      code: 'INVALID_REFUND_AMOUNT',
    });
  }

  if (resolution && !RETURN_RESOLUTION_SET.has(resolution)) {
    throw Object.assign(new Error('Invalid resolution.'), {
      code: 'INVALID_RESOLUTION',
    });
  }

  return { resolution, refundAmountCents };
}

/**
 * Compute refund/credit amount from return lines.
 *
 * @param {Array<{ quantity: number, orderLine?: { priceCents: number } }>} lines
 * @returns {number}
 */
export function computeReturnAmountCents(lines) {
  return lines.reduce((sum, line) => {
    const unitPrice = line.orderLine?.priceCents ?? 0;
    return sum + unitPrice * line.quantity;
  }, 0);
}

/**
 * Serialize a return record for admin/API responses.
 *
 * @param {object} record
 */
export function serializeReturn(record) {
  return {
    id: record.id,
    orderId: record.orderId,
    customerId: record.customerId ?? null,
    status: record.status,
    reason: record.reason ?? null,
    resolution: record.resolution ?? null,
    storeCreditCents: record.storeCreditCents ?? null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    order: record.order
      ? {
          id: record.order.id ?? record.orderId,
          orderNumber: record.order.orderNumber,
          email: record.order.email ?? null,
        }
      : undefined,
    lines: (record.lines ?? []).map((line) => ({
      id: line.id,
      orderLineId: line.orderLineId,
      quantity: line.quantity,
      restocked: line.restocked ?? false,
      title: line.orderLine?.title ?? null,
      sku: line.orderLine?.sku ?? null,
      priceCents: line.orderLine?.priceCents ?? null,
    })),
  };
}

function throwReturnNotFound(returnId) {
  throw Object.assign(new Error('Return not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    returnId,
  });
}

function throwOrderNotFound() {
  throw Object.assign(new Error('Order not found.'), {
    code: 'NOT_FOUND',
    status: 404,
  });
}

async function requireReturnRecord(returnId) {
  const returnRecord = await prisma.return.findUnique({
    where: { id: returnId },
    include: RETURN_DETAIL_INCLUDE,
  });
  if (!returnRecord) throwReturnNotFound(returnId);
  return returnRecord;
}

/**
 * @param {object[]} orderLines
 * @param {Array<{ orderLineId: string, quantity: number }>} requestedLines
 */
function validateReturnLines(orderLines, requestedLines) {
  const lineMap = new Map(orderLines.map((l) => [l.id, l]));

  for (const req of requestedLines) {
    const orderLine = lineMap.get(req.orderLineId);
    if (!orderLine) {
      throw Object.assign(new Error('Invalid order line.'), {
        code: 'INVALID_ORDER_LINE',
      });
    }

    const available = orderLine.quantity - (orderLine.returnedQuantity ?? 0);

    if (req.quantity <= 0 || req.quantity > available) {
      throw Object.assign(new Error('Invalid return quantity.'), {
        code: 'INVALID_RETURN_QUANTITY',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// requestReturn
// ---------------------------------------------------------------------------

/**
 * Customer or admin initiates a return request.
 *
 * @param {string} orderId
 * @param {{
 *   customerId?: string,
 *   reason?: string,
 *   lines: Array<{ orderLineId: string, quantity: number }>,
 * }} params
 */
export async function requestReturn(orderId, params = {}) {
  const customerId = params.customerId?.toString().trim() || undefined;
  const { reason, lines } = parseRequestReturnInput(params);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) throwOrderNotFound();

  if (customerId && order.customerId !== customerId) {
    throwOrderNotFound();
  }

  validateReturnLines(order.lines, lines);

  const returnRecord = await prisma.$transaction(async (tx) => {
    const created = await tx.return.create({
      data: {
        orderId,
        customerId: customerId ?? order.customerId ?? null,
        reason: reason ?? null,
        status: 'requested',
      },
    });

    for (const line of lines) {
      await tx.returnLine.create({
        data: {
          returnId: created.id,
          orderLineId: line.orderLineId,
          quantity: line.quantity,
        },
      });
    }

    return tx.return.findUnique({
      where: { id: created.id },
      include: RETURN_DETAIL_INCLUDE,
    });
  });

  await emit('return.requested', {
    returnId: returnRecord.id,
    orderId,
    customerId: returnRecord.customerId,
  });

  logger.info({ returnId: returnRecord.id, orderId }, 'Return requested');

  return serializeReturn(returnRecord);
}

// ---------------------------------------------------------------------------
// approveReturn
// ---------------------------------------------------------------------------

/**
 * Admin approves a return request.
 *
 * @param {string} returnId
 * @param {{ resolution?: string }} options
 */
export async function approveReturn(returnId, { resolution } = {}) {
  const returnRecord = await requireReturnRecord(returnId);
  if (returnRecord.status !== 'requested') {
    throw Object.assign(new Error('Invalid return status.'), {
      code: 'INVALID_RETURN_STATUS',
    });
  }

  if (resolution && !RETURN_RESOLUTION_SET.has(resolution)) {
    throw Object.assign(new Error('Invalid resolution.'), {
      code: 'INVALID_RESOLUTION',
    });
  }

  const updated = await prisma.return.update({
    where: { id: returnId },
    data: {
      status: 'approved',
      resolution: resolution ?? returnRecord.resolution ?? 'refund',
    },
    include: RETURN_DETAIL_INCLUDE,
  });

  await emit('return.approved', {
    returnId,
    orderId: updated.orderId,
    resolution: updated.resolution,
  });

  return serializeReturn(updated);
}

// ---------------------------------------------------------------------------
// receiveReturn
// ---------------------------------------------------------------------------

/**
 * Mark return as received and restock inventory.
 *
 * @param {string} returnId
 */
export async function receiveReturn(returnId) {
  const returnRecord = await requireReturnRecord(returnId);
  if (returnRecord.status !== 'approved') {
    throw Object.assign(new Error('Invalid return status.'), {
      code: 'INVALID_RETURN_STATUS',
    });
  }

  const inventoryItems = inventoryItemsFromLines(
    returnRecord.lines.map((line) => ({
      variantId: line.orderLine?.variantId,
      quantity: line.quantity,
    }))
  );

  await prisma.$transaction(async (tx) => {
    if (inventoryItems.length > 0) {
      await incrementInventory(inventoryItems, tx);
    }

    for (const line of returnRecord.lines) {
      await tx.returnLine.update({
        where: { id: line.id },
        data: { restocked: true },
      });

      await tx.orderLine.update({
        where: { id: line.orderLineId },
        data: {
          returnedQuantity: {
            increment: line.quantity,
          },
        },
      });
    }

    await tx.return.update({
      where: { id: returnId },
      data: { status: 'received' },
    });
  });

  const updated = await requireReturnRecord(returnId);

  await emit('return.received', {
    returnId,
    orderId: updated.orderId,
  });
  await emit('order.returned', {
    returnId,
    orderId: updated.orderId,
  });

  logger.info({ returnId, orderId: updated.orderId }, 'Return received');

  return serializeReturn(updated);
}

// ---------------------------------------------------------------------------
// completeReturn
// ---------------------------------------------------------------------------

/**
 * Complete a received return with refund or store credit.
 *
 * @param {string} returnId
 * @param {{ resolution?: string, refundAmountCents?: number }} options
 */
export async function completeReturn(returnId, options = {}) {
  const parsed = parseCompleteReturnInput(options);
  const returnRecord = await requireReturnRecord(returnId);

  if (returnRecord.status !== 'received') {
    throw Object.assign(new Error('Invalid return status.'), {
      code: 'INVALID_RETURN_STATUS',
    });
  }

  const effectiveResolution =
    parsed.resolution ?? returnRecord.resolution ?? 'refund';

  if (!RETURN_RESOLUTION_SET.has(effectiveResolution)) {
    throw Object.assign(new Error('Invalid resolution.'), {
      code: 'INVALID_RESOLUTION',
    });
  }

  const creditAmount =
    parsed.refundAmountCents ?? computeReturnAmountCents(returnRecord.lines);

  if (effectiveResolution === 'refund') {
    await createRefund(returnRecord.orderId, {
      amountCents: creditAmount,
      reason: `Return ${returnRecord.id}`,
      restoreInventory: false,
    });

    await prisma.return.update({
      where: { id: returnId },
      data: { status: 'refunded', resolution: 'refund' },
    });
  } else if (effectiveResolution === 'store_credit') {
    if (!returnRecord.customerId) {
      throw Object.assign(
        new Error('Customer is required for store credit resolution.'),
        { code: 'CUSTOMER_REQUIRED_FOR_STORE_CREDIT' }
      );
    }

    await prisma.$transaction(async (tx) => {
      await issueStoreCredit(
        returnRecord.customerId,
        {
          amountCents: creditAmount,
          reason: returnRecord.reason ?? 'Return credit',
          referenceType: 'return',
          referenceId: returnId,
        },
        tx
      );

      await tx.return.update({
        where: { id: returnId },
        data: {
          status: 'refunded',
          resolution: 'store_credit',
          storeCreditCents: creditAmount,
        },
      });
    });
  } else if (effectiveResolution === 'exchange') {
    await prisma.return.update({
      where: { id: returnId },
      data: { status: 'exchanged', resolution: 'exchange' },
    });
  }

  const updated = await requireReturnRecord(returnId);

  await emit('return.completed', {
    returnId,
    orderId: updated.orderId,
    resolution: effectiveResolution,
    amountCents: creditAmount,
  });

  return serializeReturn(updated);
}

// ---------------------------------------------------------------------------
// cancelReturn
// ---------------------------------------------------------------------------

/**
 * Cancel a return request (before received).
 *
 * @param {string} returnId
 */
export async function cancelReturn(returnId) {
  const returnRecord = await requireReturnRecord(returnId);

  if (!['requested', 'approved'].includes(returnRecord.status)) {
    throw Object.assign(new Error('Invalid return status.'), {
      code: 'INVALID_RETURN_STATUS',
    });
  }

  const updated = await prisma.return.update({
    where: { id: returnId },
    data: { status: 'cancelled' },
    include: RETURN_DETAIL_INCLUDE,
  });

  await emit('return.cancelled', { returnId, orderId: updated.orderId });

  return serializeReturn(updated);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get a single return by id.
 *
 * @param {string} returnId
 */
export async function getReturn(returnId) {
  const returnRecord = await requireReturnRecord(returnId);
  return serializeReturn(returnRecord);
}

/**
 * List returns with optional filters and pagination.
 *
 * @param {{
 *   orderId?: string,
 *   customerId?: string,
 *   status?: string,
 *   page?: number,
 *   limit?: number,
 * }} options
 * @returns {Promise<{ returns: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listReturns(options = {}) {
  const params =
    options.page != null || options.limit != null
      ? options
      : parseReturnListParams(options);

  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_RETURN_LIST_LIMIT,
    maxLimit: MAX_RETURN_LIST_RESULTS,
  });
  const where = buildReturnWhere(params);

  const [items, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: RETURN_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.return.count({ where }),
  ]);

  return {
    returns: items.map(serializeReturn),
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}
