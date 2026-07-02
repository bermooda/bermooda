// app/core/pos/index.server.js
// Point-of-sale draft orders for in-store checkout.

import prisma from '#/libs/prisma.server';

export async function openPosSession({ staffId, locationId }) {
  return prisma.posSession.create({
    data: { staffId, locationId: locationId ?? null, status: 'open' },
  });
}

export async function closePosSession(sessionId) {
  return prisma.posSession.update({
    where: { id: sessionId },
    data: { status: 'closed', closedAt: new Date() },
  });
}

export async function createPosDraftOrder({
  posSessionId,
  currency = 'USD',
  totalCents = 0,
}) {
  return prisma.posOrder.create({
    data: {
      posSessionId,
      status: 'draft',
      currency,
      totalCents,
    },
  });
}

export async function completePosOrder(posOrderId, orderId) {
  return prisma.posOrder.update({
    where: { id: posOrderId },
    data: { orderId, status: 'completed' },
  });
}

export async function getPosSession(sessionId) {
  return prisma.posSession.findUnique({
    where: { id: sessionId },
    include: { orders: true, location: true },
  });
}
