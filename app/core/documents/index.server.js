// app/core/documents/index.server.js
// PDF document generation for invoices and packing slips.

import PDFDocument from 'pdfkit';

import config from '#/core/config';
import prisma from '#/libs/prisma.server';

const INVOICE_ORDER_INCLUDE = {
  lines: { orderBy: { createdAt: 'asc' } },
};

const PACKING_SLIP_SHIPMENT_INCLUDE = {
  lines: { include: { orderLine: true } },
  order: true,
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format cents as a localized currency string.
 *
 * @param {number} cents
 * @param {string} [currency]
 */
export function formatCents(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Parse a JSON address payload safely.
 *
 * @param {string|null|undefined} json
 */
export function parseAddressJson(json) {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Normalize an address object into printable lines.
 *
 * @param {Record<string, string|undefined|null>} addr
 */
export function formatAddressLines(addr = {}) {
  const lines = [];
  if (addr.name) lines.push(addr.name);
  if (addr.line1) lines.push(addr.line1);
  if (addr.line2) lines.push(addr.line2);
  const cityLine = [addr.city, addr.state, addr.postalCode]
    .filter(Boolean)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  return lines;
}

/**
 * Build a PDF download response for admin/API routes.
 *
 * @param {Buffer} buffer
 * @param {string} filename
 */
export function buildDocumentPdfResponse(buffer, filename) {
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Map document generation errors to HTTP responses.
 *
 * @param {Error & { code?: string }} err
 */
export function mapDocumentErrorResponse(err) {
  if (err.code === 'NOT_FOUND') {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 404 }
    );
  }
  return Response.json(
    { error: err.message, code: err.code ?? 'DOCUMENT_ERROR' },
    { status: 422 }
  );
}

/**
 * @param {import('pdfkit')} doc
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
 * @param {import('pdfkit')} doc
 * @param {Record<string, string|undefined|null>} addr
 * @param {string} label
 */
function writeAddressBlock(doc, addr, label) {
  const lines = formatAddressLines(addr);
  if (lines.length === 0) return false;
  doc.text(`${label}:`);
  for (const line of lines) doc.text(line);
  doc.moveDown();
  return true;
}

function notFound(entity) {
  throw Object.assign(new Error(`${entity} not found`), { code: 'NOT_FOUND' });
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

/**
 * Load an order with line items for invoice generation.
 *
 * @param {string} orderId
 */
export async function loadOrderForInvoice(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: INVOICE_ORDER_INCLUDE,
  });
  if (!order) notFound('Order');
  return order;
}

/**
 * Load a shipment with order lines for packing slip generation.
 *
 * @param {string} shipmentId
 */
export async function loadShipmentForPackingSlip(shipmentId) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: PACKING_SLIP_SHIPMENT_INCLUDE,
  });
  if (!shipment) notFound('Shipment');
  return shipment;
}

/**
 * Resolve packing slip line items, falling back to full order lines.
 *
 * @param {Awaited<ReturnType<typeof loadShipmentForPackingSlip>>} shipment
 */
export async function resolvePackingSlipLines(shipment) {
  if (shipment.lines.length > 0) {
    return shipment.lines.map((sl) => ({
      title: sl.orderLine.title,
      sku: sl.orderLine.sku,
      quantity: sl.quantity,
    }));
  }

  const orderLines = await prisma.orderLine.findMany({
    where: { orderId: shipment.orderId },
    orderBy: { createdAt: 'asc' },
  });

  return orderLines.map((ol) => ({
    title: ol.title,
    sku: ol.sku,
    quantity: ol.quantity,
  }));
}

/**
 * @param {{ id: string, orderNumber?: string|null }} order
 */
export function buildInvoiceFilename(order) {
  return `invoice-${order.orderNumber || order.id}.pdf`;
}

/**
 * @param {{ id: string, orderId: string, order: { orderNumber?: string|null } }} shipment
 */
export function buildPackingSlipFilename(shipment) {
  const shortId = shipment.id.slice(-8).toUpperCase();
  const orderRef = shipment.order.orderNumber || shipment.orderId;
  return `packing-slip-${orderRef}-${shortId}.pdf`;
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

/**
 * Generate an invoice PDF for an order.
 *
 * @param {string} orderId
 * @returns {Promise<Buffer>}
 */
export async function generateInvoicePdf(orderId) {
  const order = await loadOrderForInvoice(orderId);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const addr = parseAddressJson(order.shippingAddressJson);

  doc.fontSize(20).text(config.appName ?? 'bermooda', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(14).text('Invoice', { align: 'left' });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Order: ${order.orderNumber}`);
  doc.text(`Date: ${order.createdAt.toISOString().slice(0, 10)}`);
  doc.text(`Status: ${order.status}`);
  doc.moveDown();

  writeAddressBlock(doc, addr, 'Bill To');

  doc.text('Items:', { underline: true });
  doc.moveDown(0.5);

  for (const line of order.lines) {
    doc.text(
      `${line.title}  ×${line.quantity}  @ ${formatCents(line.priceCents, order.currency)}  = ${formatCents(line.totalCents, order.currency)}`
    );
  }

  doc.moveDown();
  doc.text(`Subtotal: ${formatCents(order.subtotalCents, order.currency)}`, {
    align: 'right',
  });
  if (order.shippingCents > 0) {
    doc.text(`Shipping: ${formatCents(order.shippingCents, order.currency)}`, {
      align: 'right',
    });
  }
  if (order.taxCents > 0) {
    doc.text(`Tax: ${formatCents(order.taxCents, order.currency)}`, {
      align: 'right',
    });
  }
  if (order.discountCents > 0) {
    doc.text(`Discount: -${formatCents(order.discountCents, order.currency)}`, {
      align: 'right',
    });
  }
  doc
    .fontSize(12)
    .text(`Total: ${formatCents(order.totalCents, order.currency)}`, {
      align: 'right',
    });

  return pdfToBuffer(doc);
}

/**
 * Generate a packing slip PDF for a shipment.
 *
 * @param {string} shipmentId
 * @returns {Promise<Buffer>}
 */
export async function generatePackingSlipPdf(shipmentId) {
  const shipment = await loadShipmentForPackingSlip(shipmentId);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const addr = parseAddressJson(shipment.order.shippingAddressJson);

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

  writeAddressBlock(doc, addr, 'Ship To');

  doc.text('Items:', { underline: true });
  doc.moveDown(0.5);

  const lines = await resolvePackingSlipLines(shipment);
  for (const line of lines) {
    const sku = line.sku ? ` [${line.sku}]` : '';
    doc.text(`${line.title}${sku}  ×${line.quantity}`);
  }

  return pdfToBuffer(doc);
}
