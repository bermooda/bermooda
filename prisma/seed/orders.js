/**
 * Demo orders with lines, shipments, refunds, and returns.
 */

import { listSeedCustomers } from './customers.js';
import { addressJson, daysAgo } from './helpers.js';
import { CATALOG, orderId, orderNumber } from './ids.js';

/** @typedef {'pending' | 'pending_payment' | 'confirmed' | 'paid' | 'fulfilled' | 'cancelled' | 'refunded'} OrderStatus */

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedOrders(prisma) {
  const customers = await listSeedCustomers(prisma);
  if (customers.length === 0) {
    console.warn('No customers found; skipping orders.');
    return;
  }

  const onlineChannel = await prisma.salesChannel.findUnique({
    where: { handle: 'online' },
  });

  /** @type {Array<{ status: OrderStatus, daysAgo: number, lineCount: number, withShipment?: boolean, withRefund?: boolean, withReturn?: boolean, withDiscount?: boolean, cancelled?: boolean }>} */
  const specs = [
    { status: 'pending', daysAgo: 1, lineCount: 1 },
    { status: 'pending_payment', daysAgo: 2, lineCount: 2 },
    { status: 'confirmed', daysAgo: 3, lineCount: 1 },
    { status: 'paid', daysAgo: 4, lineCount: 2 },
    { status: 'paid', daysAgo: 5, lineCount: 3, withShipment: true },
    {
      status: 'fulfilled',
      daysAgo: 8,
      lineCount: 2,
      withShipment: true,
    },
    {
      status: 'fulfilled',
      daysAgo: 10,
      lineCount: 1,
      withShipment: true,
    },
    {
      status: 'fulfilled',
      daysAgo: 12,
      lineCount: 2,
      withShipment: true,
      withReturn: true,
    },
    {
      status: 'refunded',
      daysAgo: 15,
      lineCount: 1,
      withShipment: true,
      withRefund: true,
    },
    { status: 'cancelled', daysAgo: 6, lineCount: 1, cancelled: true },
    {
      status: 'fulfilled',
      daysAgo: 18,
      lineCount: 3,
      withShipment: true,
      withDiscount: true,
    },
    {
      status: 'paid',
      daysAgo: 7,
      lineCount: 1,
      withDiscount: true,
    },
    {
      status: 'fulfilled',
      daysAgo: 20,
      lineCount: 2,
      withShipment: true,
    },
    {
      status: 'confirmed',
      daysAgo: 9,
      lineCount: 1,
    },
    {
      status: 'fulfilled',
      daysAgo: 25,
      lineCount: 2,
      withShipment: true,
      withRefund: true,
      withReturn: true,
    },
  ];

  for (let i = 0; i < specs.length; i++) {
    const index = i + 1;
    const spec = specs[i];
    const customer = customers[i % customers.length];
    const items = [];
    let subtotalCents = 0;

    for (let L = 0; L < spec.lineCount; L++) {
      const catalogItem = CATALOG[(i + L) % CATALOG.length];
      const quantity = 1 + ((i + L) % 2);
      const lineTotal = catalogItem.priceCents * quantity;
      subtotalCents += lineTotal;
      items.push({
        id: `seed-ol-${String(index).padStart(2, '0')}-${L + 1}`,
        variantId: catalogItem.variantId,
        title: catalogItem.title,
        sku: catalogItem.sku,
        quantity,
        priceCents: catalogItem.priceCents,
        totalCents: lineTotal,
        fulfilledQuantity:
          spec.status === 'fulfilled' || spec.status === 'refunded'
            ? quantity
            : spec.withShipment
              ? quantity
              : 0,
      });
    }

    const shippingCents = subtotalCents >= 7500 ? 0 : 799;
    const discountCents = spec.withDiscount
      ? Math.round(subtotalCents * 0.1)
      : 0;
    const taxCents = Math.round((subtotalCents - discountCents) * 0.0875);
    const totalCents = subtotalCents + shippingCents + taxCents - discountCents;

    const id = orderId(index);
    const number = orderNumber(index);
    const createdAt = daysAgo(spec.daysAgo);

    await prisma.order.upsert({
      where: { orderNumber: number },
      create: {
        id,
        orderNumber: number,
        customerId: customer.id,
        salesChannelId: onlineChannel?.id ?? null,
        email: customer.email,
        status: spec.status,
        currency: 'USD',
        subtotalCents,
        shippingCents,
        taxCents,
        discountCents,
        totalCents,
        shippingAddressJson: addressJson({
          firstName: customer.name?.split(' ')[0] ?? 'Alex',
          lastName: customer.name?.split(' ').slice(1).join(' ') || 'Rivera',
        }),
        billingAddressJson: addressJson(),
        paymentProvider: spec.cancelled ? null : 'manual',
        paymentIntentId: spec.cancelled ? null : `seed_pi_${index}`,
        couponCode: spec.withDiscount ? 'WELCOME10' : null,
        notes: spec.cancelled ? 'Customer cancelled before payment.' : null,
        createdAt,
      },
      update: {
        status: spec.status,
        customerId: customer.id,
        email: customer.email,
        subtotalCents,
        shippingCents,
        taxCents,
        discountCents,
        totalCents,
      },
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: number },
    });

    // Clear dependents before replacing lines (FK: shipment/return lines → order lines)
    const existingShipments = await prisma.shipment.findMany({
      where: { orderId: order.id },
      select: { id: true },
    });
    if (existingShipments.length > 0) {
      await prisma.shipmentLine.deleteMany({
        where: {
          shipmentId: { in: existingShipments.map((s) => s.id) },
        },
      });
      await prisma.shipment.deleteMany({ where: { orderId: order.id } });
    }
    const existingReturns = await prisma.return.findMany({
      where: { orderId: order.id },
      select: { id: true },
    });
    if (existingReturns.length > 0) {
      await prisma.returnLine.deleteMany({
        where: { returnId: { in: existingReturns.map((r) => r.id) } },
      });
      await prisma.return.deleteMany({ where: { orderId: order.id } });
    }
    await prisma.orderDiscount.deleteMany({ where: { orderId: order.id } });
    await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
    await prisma.orderLine.createMany({
      data: items.map((line) => ({
        ...line,
        orderId: order.id,
      })),
    });

    const lines = await prisma.orderLine.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });

    if (spec.withDiscount) {
      const welcomeDiscount = await prisma.discount.findUnique({
        where: { code: 'WELCOME10' },
      });
      if (welcomeDiscount) {
        await prisma.orderDiscount.create({
          data: {
            id: `seed-od-${String(index).padStart(2, '0')}`,
            orderId: order.id,
            discountId: welcomeDiscount.id,
            code: 'WELCOME10',
            type: 'percent',
            value: 10,
            discountCents,
          },
        });
      }
    }

    if (spec.withShipment && lines.length > 0) {
      const shipmentId = `seed-ship-${String(index).padStart(2, '0')}`;
      const shipped =
        spec.status === 'fulfilled' ||
        spec.status === 'refunded' ||
        spec.withShipment;
      await prisma.shipment.create({
        data: {
          id: shipmentId,
          orderId: order.id,
          status: shipped ? 'shipped' : 'pending',
          carrier: 'UPS',
          trackingNumber: `1Z999AA1${String(1000000000 + index).slice(-10)}`,
          trackingUrl: `https://www.ups.com/track?tracknum=DEMO${index}`,
          shippedAt: shipped ? daysAgo(spec.daysAgo - 1) : null,
          deliveredAt:
            spec.status === 'fulfilled' || spec.status === 'refunded'
              ? daysAgo(Math.max(0, spec.daysAgo - 3))
              : null,
          lines: {
            create: lines.map((line, li) => ({
              id: `seed-sl-${String(index).padStart(2, '0')}-${li + 1}`,
              orderLineId: line.id,
              quantity: line.quantity,
            })),
          },
        },
      });
    }

    if (spec.withRefund && lines.length > 0) {
      const refundId = `seed-refund-${String(index).padStart(2, '0')}`;
      await prisma.refund.upsert({
        where: { id: refundId },
        create: {
          id: refundId,
          orderId: order.id,
          amountCents: Math.round(totalCents * 0.5),
          reason: 'Partial refund — damaged item',
          status: 'succeeded',
          providerRefundId: `seed_re_${index}`,
        },
        update: {
          amountCents: Math.round(totalCents * 0.5),
          status: 'succeeded',
        },
      });
    }

    if (spec.withReturn && lines.length > 0) {
      const returnId = `seed-return-${String(index).padStart(2, '0')}`;
      await prisma.return.create({
        data: {
          id: returnId,
          orderId: order.id,
          customerId: customer.id,
          status: 'requested',
          reason: 'Item not as described',
          resolution: 'refund',
          lines: {
            create: [
              {
                id: `seed-rl-${String(index).padStart(2, '0')}-1`,
                orderLineId: lines[0].id,
                quantity: 1,
                restocked: false,
              },
            ],
          },
        },
      });
    }
  }

  console.log(
    `Seeded ${specs.length} demo orders with shipments/refunds/returns.`
  );
}
