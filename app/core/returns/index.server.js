// app/core/returns/index.server.js
// Returns/RMA service: customer and admin flows, restock on receipt.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { emit } from '#/core/events/index.server';
import { incrementInventory } from '#/core/inventory/index.server';
import { createRefund } from '#/core/orders/index.server';
import { issueStoreCredit } from '#/core/store-credit/index.server';

const VALID_RETURN_STATUSES = new Set([
  'requested',
  'approved',
  'received',
  'refunded',
  'exchanged',
  'cancelled',
]);

const VALID_RESOLUTIONS = new Set(['refund', 'store_credit', 'exchange']);

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
 * @returns {Promise<object>}
 */
export async function requestReturn(orderId, { customerId, reason, lines }) {
  if (!lines?.length) {
    throw new Error('RETURN_LINES_REQUIRED');
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  if (customerId && order.customerId !== customerId) {
    throw new Error('ORDER_NOT_FOUND');
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
      include: { lines: { include: { orderLine: true } } },
    });
  });

  await emit('return.requested', {
    returnId: returnRecord.id,
    orderId,
    customerId: returnRecord.customerId,
  });

  logger.info({ returnId: returnRecord.id, orderId }, 'Return requested');

  return returnRecord;
}

// ---------------------------------------------------------------------------
// approveReturn
// ---------------------------------------------------------------------------

/**
 * Admin approves a return request.
 * @param {string} returnId
 * @param {{ resolution?: string }} options
 * @returns {Promise<object>}
 */
export async function approveReturn(returnId, { resolution } = {}) {
  const returnRecord = await getReturn(returnId);
  if (!returnRecord) throw new Error('RETURN_NOT_FOUND');
  if (returnRecord.status !== 'requested') {
    throw new Error('INVALID_RETURN_STATUS');
  }

  if (resolution && !VALID_RESOLUTIONS.has(resolution)) {
    throw new Error('INVALID_RESOLUTION');
  }

  const updated = await prisma.return.update({
    where: { id: returnId },
    data: {
      status: 'approved',
      resolution: resolution ?? returnRecord.resolution ?? 'refund',
    },
    include: { lines: { include: { orderLine: true } } },
  });

  await emit('return.approved', {
    returnId,
    orderId: updated.orderId,
    resolution: updated.resolution,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// receiveReturn
// ---------------------------------------------------------------------------

/**
 * Mark return as received and restock inventory.
 * @param {string} returnId
 * @returns {Promise<object>}
 */
export async function receiveReturn(returnId) {
  const returnRecord = await getReturn(returnId);
  if (!returnRecord) throw new Error('RETURN_NOT_FOUND');
  if (returnRecord.status !== 'approved') {
    throw new Error('INVALID_RETURN_STATUS');
  }

  const inventoryItems = returnRecord.lines
    .filter((line) => line.orderLine?.variantId)
    .map((line) => ({
      variantId: line.orderLine.variantId,
      quantity: line.quantity,
    }));

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

  const updated = await getReturn(returnId);

  await emit('return.received', {
    returnId,
    orderId: updated.orderId,
  });
  await emit('order.returned', {
    returnId,
    orderId: updated.orderId,
  });

  logger.info({ returnId, orderId: updated.orderId }, 'Return received');

  return updated;
}

// ---------------------------------------------------------------------------
// completeReturn
// ---------------------------------------------------------------------------

/**
 * Complete a received return with refund or store credit.
 *
 * @param {string} returnId
 * @param {{ resolution?: string, refundAmountCents?: number }} options
 * @returns {Promise<object>}
 */
export async function completeReturn(
  returnId,
  { resolution, refundAmountCents } = {}
) {
  const returnRecord = await getReturn(returnId);
  if (!returnRecord) throw new Error('RETURN_NOT_FOUND');
  if (returnRecord.status !== 'received') {
    throw new Error('INVALID_RETURN_STATUS');
  }

  const effectiveResolution = resolution ?? returnRecord.resolution ?? 'refund';

  if (!VALID_RESOLUTIONS.has(effectiveResolution)) {
    throw new Error('INVALID_RESOLUTION');
  }

  const creditAmount =
    refundAmountCents ?? computeReturnAmountCents(returnRecord.lines);

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
      throw new Error('CUSTOMER_REQUIRED_FOR_STORE_CREDIT');
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

  const updated = await getReturn(returnId);

  await emit('return.completed', {
    returnId,
    orderId: updated.orderId,
    resolution: effectiveResolution,
    amountCents: creditAmount,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// cancelReturn
// ---------------------------------------------------------------------------

/**
 * Cancel a return request (before received).
 * @param {string} returnId
 * @returns {Promise<object>}
 */
export async function cancelReturn(returnId) {
  const returnRecord = await getReturn(returnId);
  if (!returnRecord) throw new Error('RETURN_NOT_FOUND');

  if (!['requested', 'approved'].includes(returnRecord.status)) {
    throw new Error('INVALID_RETURN_STATUS');
  }

  const updated = await prisma.return.update({
    where: { id: returnId },
    data: { status: 'cancelled' },
    include: { lines: { include: { orderLine: true } } },
  });

  await emit('return.cancelled', { returnId, orderId: updated.orderId });

  return updated;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * @param {string} returnId
 * @returns {Promise<object|null>}
 */
export async function getReturn(returnId) {
  return prisma.return.findUnique({
    where: { id: returnId },
    include: {
      lines: { include: { orderLine: true } },
      order: { select: { orderNumber: true, email: true, customerId: true } },
    },
  });
}

/**
 * @param {{ orderId?: string, customerId?: string, status?: string, page?: number, limit?: number }} options
 * @returns {Promise<object[]>}
 */
export async function listReturns({
  orderId,
  customerId,
  status,
  page = 1,
  limit = 20,
} = {}) {
  const where = {};
  if (orderId) where.orderId = orderId;
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;

  const skip = (page - 1) * limit;

  return prisma.return.findMany({
    where,
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {object[]} orderLines
 * @param {Array<{ orderLineId: string, quantity: number }>} requestedLines
 */
function validateReturnLines(orderLines, requestedLines) {
  const lineMap = new Map(orderLines.map((l) => [l.id, l]));

  for (const req of requestedLines) {
    const orderLine = lineMap.get(req.orderLineId);
    if (!orderLine) {
      throw new Error('INVALID_ORDER_LINE');
    }

    const available = orderLine.quantity - (orderLine.returnedQuantity ?? 0);

    if (req.quantity <= 0 || req.quantity > available) {
      throw new Error('INVALID_RETURN_QUANTITY');
    }
  }
}

/**
 * @param {Array<{ quantity: number, orderLine?: { priceCents: number } }>} lines
 * @returns {number}
 */
function computeReturnAmountCents(lines) {
  return lines.reduce((sum, line) => {
    const unitPrice = line.orderLine?.priceCents ?? 0;
    return sum + unitPrice * line.quantity;
  }, 0);
}

export { VALID_RETURN_STATUSES, VALID_RESOLUTIONS };
