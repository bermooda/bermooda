// app/core/orders/fulfillment.server.js
// Shipment creation and fulfillment status sync.

import prisma from '#/libs/prisma.server';
import { emitBefore } from '#/core/events/index.server';
import { queueEmit } from '#/core/events/job.server';
import { updateOrderStatus } from '#/core/orders/admin.server';

/**
 * Derive fulfillment status from order line quantities.
 * @param {Array<{ quantity: number, fulfilledQuantity: number }>} lines
 * @returns {'unfulfilled'|'partial'|'fulfilled'}
 */
export function deriveFulfillmentStatus(lines) {
  if (!lines?.length) return 'unfulfilled';

  const totalQty = lines.reduce((sum, l) => sum + l.quantity, 0);
  const fulfilledQty = lines.reduce(
    (sum, l) => sum + (l.fulfilledQuantity ?? 0),
    0
  );

  if (fulfilledQty === 0) return 'unfulfilled';
  if (fulfilledQty >= totalQty) return 'fulfilled';
  return 'partial';
}

/**
 * Sync order status from fulfillment state.
 * @param {string} orderId
 * @param {import('@prisma/client').Prisma.TransactionClient} [tx]
 * @returns {Promise<void>}
 */
export async function syncOrderFulfillmentStatus(orderId, tx) {
  const client = tx ?? prisma;
  const order = await client.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) return;

  const fulfillment = deriveFulfillmentStatus(order.lines);

  if (
    fulfillment === 'fulfilled' &&
    ['paid', 'confirmed'].includes(order.status)
  ) {
    if (tx) {
      await client.order.update({
        where: { id: orderId },
        data: { status: 'fulfilled' },
      });
      await queueEmit('order.updated', {
        orderId,
        previousStatus: order.status,
        status: 'fulfilled',
      });
    } else {
      await updateOrderStatus(orderId, 'fulfilled');
    }

    await queueEmit('order.fulfilled', {
      orderId,
      status: 'fulfilled',
    });
  }
}

/**
 * @param {object[]} orderLines
 * @param {Array<{ orderLineId: string, quantity: number }>} requestedLines
 */
function validateShipmentLines(orderLines, requestedLines) {
  const lineMap = new Map(orderLines.map((l) => [l.id, l]));

  for (const req of requestedLines) {
    const orderLine = lineMap.get(req.orderLineId);
    if (!orderLine) {
      throw new Error('INVALID_ORDER_LINE');
    }

    const remaining = orderLine.quantity - (orderLine.fulfilledQuantity ?? 0);

    if (req.quantity <= 0 || req.quantity > remaining) {
      throw new Error('INVALID_SHIPMENT_QUANTITY');
    }
  }
}

/**
 * Create a Shipment record for an order with optional per-line quantities.
 * @param {string} orderId
 * @param {{
 *   carrier?: string,
 *   trackingNumber?: string,
 *   trackingUrl?: string,
 *   lines?: Array<{ orderLineId: string, quantity: number }>,
 * }} data
 * @returns {Promise<object>} created Shipment
 */
export async function addShipment(orderId, data = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const shipmentLines = data.lines ?? [];

  if (shipmentLines.length > 0) {
    validateShipmentLines(order.lines, shipmentLines);
  }

  await emitBefore('shipment.create', { orderId, order, data });

  const shipment = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId,
        carrier: data.carrier ?? null,
        trackingNumber: data.trackingNumber ?? null,
        trackingUrl: data.trackingUrl ?? null,
      },
    });

    for (const line of shipmentLines) {
      await tx.shipmentLine.create({
        data: {
          shipmentId: created.id,
          orderLineId: line.orderLineId,
          quantity: line.quantity,
        },
      });
    }

    return tx.shipment.findUnique({
      where: { id: created.id },
      include: { lines: { include: { orderLine: true } } },
    });
  });

  await queueEmit('shipment.created', { shipmentId: shipment.id, orderId });

  return shipment;
}

/**
 * Mark a shipment as shipped.
 * @param {string} shipmentId
 * @param {{ carrier?: string, trackingNumber?: string, trackingUrl?: string }} data
 * @returns {Promise<object>} updated Shipment
 */
export async function markShipped(
  shipmentId,
  { carrier, trackingNumber, trackingUrl } = {}
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { lines: true, order: { include: { lines: true } } },
  });

  if (!shipment) {
    throw new Error('SHIPMENT_NOT_FOUND');
  }

  await emitBefore('shipment.ship', {
    shipmentId,
    orderId: shipment.orderId,
    shipment,
    order: shipment.order,
    data: { carrier, trackingNumber, trackingUrl },
  });

  const updateData = {
    status: 'shipped',
    shippedAt: new Date(),
  };

  if (carrier !== undefined) updateData.carrier = carrier;
  if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
  if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.shipment.update({
      where: { id: shipmentId },
      data: updateData,
      include: { lines: true },
    });

    const linesToFulfill =
      result.lines.length > 0
        ? result.lines
        : shipment.order.lines.map((ol) => ({
            orderLineId: ol.id,
            quantity: ol.quantity - (ol.fulfilledQuantity ?? 0),
          }));

    for (const line of linesToFulfill) {
      if (line.quantity <= 0) continue;

      await tx.orderLine.update({
        where: { id: line.orderLineId },
        data: {
          fulfilledQuantity: { increment: line.quantity },
        },
      });

      if (result.lines.length === 0) {
        await tx.shipmentLine.create({
          data: {
            shipmentId,
            orderLineId: line.orderLineId,
            quantity: line.quantity,
          },
        });
      }
    }

    await syncOrderFulfillmentStatus(shipment.orderId, tx);

    return result;
  });

  await queueEmit('shipment.shipped', {
    shipmentId,
    orderId: shipment.orderId,
    carrier: updated.carrier,
    trackingNumber: updated.trackingNumber,
    trackingUrl: updated.trackingUrl,
  });

  return updated;
}

/**
 * Mark a shipment as delivered.
 * @param {string} shipmentId
 * @returns {Promise<object>} updated Shipment
 */
export async function markDelivered(shipmentId) {
  const existing = await prisma.shipment.findUnique({
    where: { id: shipmentId },
  });

  if (!existing) {
    throw new Error('SHIPMENT_NOT_FOUND');
  }

  await emitBefore('shipment.deliver', {
    shipmentId,
    orderId: existing.orderId,
    shipment: existing,
  });

  const shipment = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status: 'delivered',
      deliveredAt: new Date(),
    },
  });

  await queueEmit('shipment.delivered', {
    shipmentId,
    orderId: shipment.orderId,
  });

  return shipment;
}
