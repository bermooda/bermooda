// app/core/documents/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    order: { findUnique: vi.fn() },
    shipment: { findUnique: vi.fn() },
    orderLine: { findMany: vi.fn() },
  },
}));

vi.mock('#/config', () => ({
  default: { appName: 'bermooda' },
}));

import prisma from '#/libs/prisma.server';
import {
  buildDocumentPdfResponse,
  buildInvoiceFilename,
  buildPackingSlipFilename,
  formatAddressLines,
  formatCents,
  generateInvoicePdf,
  generatePackingSlipPdf,
  loadOrderForInvoice,
  loadShipmentForPackingSlip,
  mapDocumentErrorResponse,
  parseAddressJson,
  resolvePackingSlipLines,
} from '#/core/documents/index.server';

const sampleOrder = {
  id: 'order-1',
  orderNumber: 'ORD-123',
  status: 'paid',
  currency: 'USD',
  subtotalCents: 1000,
  shippingCents: 500,
  taxCents: 100,
  discountCents: 0,
  totalCents: 1600,
  createdAt: new Date('2026-01-01'),
  shippingAddressJson: JSON.stringify({
    name: 'Jane Doe',
    line1: '123 Main St',
    city: 'NYC',
    country: 'US',
  }),
  lines: [
    {
      title: 'Widget',
      quantity: 1,
      priceCents: 1000,
      totalCents: 1000,
    },
  ],
};

const sampleShipment = {
  id: 'ship-abcdef12',
  orderId: 'order-1',
  carrier: 'UPS',
  trackingNumber: '1Z999',
  lines: [
    {
      quantity: 1,
      orderLine: { title: 'Widget', sku: 'W-1' },
    },
  ],
  order: {
    orderNumber: 'ORD-123',
    shippingAddressJson: JSON.stringify({ line1: '123 Main' }),
  },
};

describe('documents helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formatCents formats currency strings', () => {
    expect(formatCents(1600, 'USD')).toContain('16.00');
  });

  it('parseAddressJson returns empty object for invalid JSON', () => {
    expect(parseAddressJson('not-json')).toEqual({});
    expect(parseAddressJson(null)).toEqual({});
  });

  it('formatAddressLines normalizes printable address lines', () => {
    expect(
      formatAddressLines({
        name: 'Jane Doe',
        line1: '123 Main St',
        city: 'NYC',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      })
    ).toEqual(['Jane Doe', '123 Main St', 'NYC, NY, 10001', 'US']);
  });

  it('buildInvoiceFilename prefers order number', () => {
    expect(
      buildInvoiceFilename({ id: 'order-1', orderNumber: 'ORD-123' })
    ).toBe('invoice-ORD-123.pdf');
    expect(buildInvoiceFilename({ id: 'order-1' })).toBe('invoice-order-1.pdf');
  });

  it('buildPackingSlipFilename includes order number and shipment suffix', () => {
    expect(buildPackingSlipFilename(sampleShipment)).toBe(
      'packing-slip-ORD-123-ABCDEF12.pdf'
    );
  });

  it('buildDocumentPdfResponse sets PDF headers', () => {
    const response = buildDocumentPdfResponse(
      Buffer.from('%PDF'),
      'invoice.pdf'
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="invoice.pdf"'
    );
  });

  it('mapDocumentErrorResponse maps NOT_FOUND to 404', async () => {
    const response = mapDocumentErrorResponse(
      Object.assign(new Error('Order not found'), { code: 'NOT_FOUND' })
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Order not found',
      code: 'NOT_FOUND',
    });
  });
});

describe('documents loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadOrderForInvoice returns order data', async () => {
    prisma.order.findUnique.mockResolvedValue(sampleOrder);
    await expect(loadOrderForInvoice('order-1')).resolves.toEqual(sampleOrder);
  });

  it('loadOrderForInvoice throws NOT_FOUND for missing order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(loadOrderForInvoice('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  });

  it('loadShipmentForPackingSlip returns shipment data', async () => {
    prisma.shipment.findUnique.mockResolvedValue(sampleShipment);
    await expect(loadShipmentForPackingSlip('ship-1')).resolves.toEqual(
      sampleShipment
    );
  });

  it('loadShipmentForPackingSlip throws NOT_FOUND for missing shipment', async () => {
    prisma.shipment.findUnique.mockResolvedValue(null);
    await expect(loadShipmentForPackingSlip('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Shipment not found',
    });
  });

  it('resolvePackingSlipLines falls back to order lines', async () => {
    prisma.orderLine.findMany.mockResolvedValue([
      { title: 'Fallback Item', sku: 'FB-1', quantity: 2 },
    ]);

    const lines = await resolvePackingSlipLines({
      orderId: 'order-1',
      lines: [],
    });

    expect(lines).toEqual([
      { title: 'Fallback Item', sku: 'FB-1', quantity: 2 },
    ]);
    expect(prisma.orderLine.findMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      orderBy: { createdAt: 'asc' },
    });
  });
});

describe('documents PDF generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generateInvoicePdf returns a PDF buffer', async () => {
    prisma.order.findUnique.mockResolvedValue(sampleOrder);

    const pdf = await generateInvoicePdf('order-1');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generateInvoicePdf throws for missing order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(generateInvoicePdf('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('generatePackingSlipPdf returns a PDF buffer', async () => {
    prisma.shipment.findUnique.mockResolvedValue(sampleShipment);

    const pdf = await generatePackingSlipPdf('ship-1');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generatePackingSlipPdf throws for missing shipment', async () => {
    prisma.shipment.findUnique.mockResolvedValue(null);
    await expect(generatePackingSlipPdf('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
