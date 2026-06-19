// app/core/documents/index.server.js
// PDF document generation for invoices and packing slips.

import PDFDocument from 'pdfkit';

import config from '#/config';
import prisma from '#/libs/prisma.server';

/**
 * @param {PDFDocument} doc
 * @returns {Promise<Buffer>}
 */
function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Format cents as currency string.
 * @param {number} cents
 * @param {string} currency
 */
function fmt(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Parse shipping address JSON safely.
 * @param {string} json
 */
function parseAddress(json) {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Generate an invoice PDF for an order.
 * @param {string} orderId
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdf(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const addr = parseAddress(order.shippingAddressJson);

  doc.fontSize(20).text(config.appName ?? 'bermooda', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(14).text('Invoice', { align: 'left' });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Order: ${order.orderNumber}`);
  doc.text(`Date: ${order.createdAt.toISOString().slice(0, 10)}`);
  doc.text(`Status: ${order.status}`);
  doc.moveDown();

  if (addr.line1 || addr.name) {
    doc.text('Bill To:');
    if (addr.name) doc.text(addr.name);
    if (addr.line1) doc.text(addr.line1);
    if (addr.line2) doc.text(addr.line2);
    const cityLine = [addr.city, addr.state, addr.postalCode]
      .filter(Boolean)
      .join(', ');
    if (cityLine) doc.text(cityLine);
    if (addr.country) doc.text(addr.country);
    doc.moveDown();
  }

  doc.text('Items:', { underline: true });
  doc.moveDown(0.5);

  for (const line of order.lines) {
    doc.text(
      `${line.title}  ×${line.quantity}  @ ${fmt(line.priceCents, order.currency)}  = ${fmt(line.totalCents, order.currency)}`
    );
  }

  doc.moveDown();
  doc.text(`Subtotal: ${fmt(order.subtotalCents, order.currency)}`, {
    align: 'right',
  });
  if (order.shippingCents > 0) {
    doc.text(`Shipping: ${fmt(order.shippingCents, order.currency)}`, {
      align: 'right',
    });
  }
  if (order.taxCents > 0) {
    doc.text(`Tax: ${fmt(order.taxCents, order.currency)}`, { align: 'right' });
  }
  if (order.discountCents > 0) {
    doc.text(`Discount: -${fmt(order.discountCents, order.currency)}`, {
      align: 'right',
    });
  }
  doc.fontSize(12).text(`Total: ${fmt(order.totalCents, order.currency)}`, {
    align: 'right',
  });

  return pdfToBuffer(doc);
}

/**
 * Generate a packing slip PDF for a shipment.
 * @param {string} shipmentId
 * @returns {Promise<Buffer>}
 */
export async function generatePackingSlipPdf(shipmentId) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      lines: { include: { orderLine: true } },
      order: true,
    },
  });

  if (!shipment) {
    throw new Error('SHIPMENT_NOT_FOUND');
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const addr = parseAddress(shipment.order.shippingAddressJson);

  doc.fontSize(20).text('Packing Slip', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Order: ${shipment.order.orderNumber}`);
  doc.text(`Shipment: ${shipment.id.slice(-8).toUpperCase()}`);
  if (shipment.carrier) doc.text(`Carrier: ${shipment.carrier}`);
  if (shipment.trackingNumber) {
    doc.text(`Tracking: ${shipment.trackingNumber}`);
  }
  doc.moveDown();

  doc.text('Ship To:');
  if (addr.name) doc.text(addr.name);
  if (addr.line1) doc.text(addr.line1);
  if (addr.line2) doc.text(addr.line2);
  const cityLine = [addr.city, addr.state, addr.postalCode]
    .filter(Boolean)
    .join(', ');
  if (cityLine) doc.text(cityLine);
  if (addr.country) doc.text(addr.country);
  doc.moveDown();

  doc.text('Items:', { underline: true });
  doc.moveDown(0.5);

  const lines =
    shipment.lines.length > 0
      ? shipment.lines.map((sl) => ({
          title: sl.orderLine.title,
          sku: sl.orderLine.sku,
          quantity: sl.quantity,
        }))
      : (await prisma.orderLine.findMany({ where: { orderId: shipment.orderId } })).map(
          (ol) => ({
            title: ol.title,
            sku: ol.sku,
            quantity: ol.quantity,
          })
        );

  for (const line of lines) {
    const sku = line.sku ? ` [${line.sku}]` : '';
    doc.text(`${line.title}${sku}  ×${line.quantity}`);
  }

  return pdfToBuffer(doc);
}
