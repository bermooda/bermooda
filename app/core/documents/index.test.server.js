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
  generateInvoicePdf,
  generatePackingSlipPdf,
} from '#/core/documents/index.server';

describe('documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generateInvoicePdf returns a PDF buffer', async () => {
    prisma.order.findUnique.mockResolvedValue({
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
    });

    const pdf = await generateInvoicePdf('order-1');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generateInvoicePdf throws for missing order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(generateInvoicePdf('missing')).rejects.toThrow(
      'ORDER_NOT_FOUND'
    );
  });

  it('generatePackingSlipPdf returns a PDF buffer', async () => {
    prisma.shipment.findUnique.mockResolvedValue({
      id: 'ship-1',
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
    });

    const pdf = await generatePackingSlipPdf('ship-1');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generatePackingSlipPdf throws for missing shipment', async () => {
    prisma.shipment.findUnique.mockResolvedValue(null);
    await expect(generatePackingSlipPdf('missing')).rejects.toThrow(
      'SHIPMENT_NOT_FOUND'
    );
  });
});
