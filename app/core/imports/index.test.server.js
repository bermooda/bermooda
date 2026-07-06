// app/core/imports/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    productVariant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    variantPrice: { upsert: vi.fn() },
    customer: { findUnique: vi.fn() },
  },
}));

vi.mock('#/core/catalog/index.server', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock('#/core/customers/index.server', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { createProduct, updateProduct } from '#/core/catalog/index.server';
import { createCustomer, updateCustomer } from '#/core/customers/index.server';
import {
  importCustomersCsv,
  importProductsCsv,
  parseImportInput,
  parseImportPricesField,
  resolveImportTemplate,
  runImport,
  serializeImportResult,
  validateImportType,
} from '#/core/imports/index.server';

describe('imports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validateImportType accepts known types', () => {
    expect(() => validateImportType('products')).not.toThrow();
    expect(() => validateImportType('customers')).not.toThrow();
    expect(() => validateImportType('orders')).toThrow(/Invalid import type/);
  });

  it('parseImportInput validates required fields', () => {
    expect(() =>
      parseImportInput({ type: 'products', csv: 'title\nSample' })
    ).not.toThrow();

    expect(() => parseImportInput({ type: 'products' })).toThrow(/required/i);
  });

  it('parseImportPricesField parses currency pairs', () => {
    expect(parseImportPricesField('USD:1999;eur:1500')).toEqual([
      { currency: 'USD', priceCents: 1999 },
      { currency: 'EUR', priceCents: 1500 },
    ]);
    expect(parseImportPricesField('')).toEqual([]);
  });

  it('resolveImportTemplate returns downloadable CSV', () => {
    const template = resolveImportTemplate('products');
    expect(template.filename).toBe('product-import-template.csv');
    expect(template.csv).toContain('variant_id');
    expect(template.csv).toContain('Sample Product');
  });

  it('serializeImportResult normalizes error rows', () => {
    expect(
      serializeImportResult({
        created: 1,
        updated: 2,
        errors: [{ row: ['bad'], error: 'Missing title' }],
      })
    ).toEqual({
      created: 1,
      updated: 2,
      errors: [{ row: ['bad'], error: 'Missing title' }],
    });
  });

  it('importProductsCsv creates a product when no ids match', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(null);
    prisma.productVariant.findFirst.mockResolvedValue(null);
    createProduct.mockResolvedValue({ id: 'prod-1' });
    prisma.productVariant.create.mockResolvedValue({ id: 'var-1' });

    const csv = [
      'variant_id,product_id,title,sku,inventory_count,inventory_tracked,prices',
      ',,New Product,SKU-1,5,true,USD:2500',
    ].join('\n');

    const result = await importProductsCsv(csv);

    expect(result).toEqual({ created: 1, updated: 0, errors: [] });
    expect(createProduct).toHaveBeenCalledWith({
      title: 'New Product',
      productType: 'physical',
      locale: 'en',
    });
    expect(prisma.variantPrice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { variantId_currency: { variantId: 'var-1', currency: 'USD' } },
      })
    );
  });

  it('importProductsCsv updates an existing variant by variant_id', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'var-1',
      productId: 'prod-1',
    });
    prisma.productVariant.update.mockResolvedValue({});

    const csv = [
      'variant_id,product_id,title,sku,inventory_count,inventory_tracked,prices',
      'var-1,prod-1,Updated Product,SKU-2,8,false,USD:3000',
    ].join('\n');

    const result = await importProductsCsv(csv);

    expect(result).toEqual({ created: 0, updated: 1, errors: [] });
    expect(updateProduct).toHaveBeenCalledWith('prod-1', {
      title: 'Updated Product',
      locale: 'en',
    });
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('importCustomersCsv creates a new customer', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    createCustomer.mockResolvedValue({ id: 'cust-1' });

    const csv = [
      'id,email,name,phone,preferred_locale,created_at',
      ',new@example.com,Jane Doe,+15551234,en,',
    ].join('\n');

    const result = await importCustomersCsv(csv);

    expect(result).toEqual({ created: 1, updated: 0, errors: [] });
    expect(createCustomer).toHaveBeenCalledWith({
      email: 'new@example.com',
      name: 'Jane Doe',
      phone: '+15551234',
      preferredLocale: 'en',
    });
  });

  it('importCustomersCsv updates an existing customer by email', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
    updateCustomer.mockResolvedValue({});

    const csv = [
      'id,email,name,phone,preferred_locale,created_at',
      ',existing@example.com,Updated Name,,de,',
    ].join('\n');

    const result = await importCustomersCsv(csv);

    expect(result).toEqual({ created: 0, updated: 1, errors: [] });
    expect(updateCustomer).toHaveBeenCalledWith('cust-1', {
      name: 'Updated Name',
      phone: null,
      preferredLocale: 'de',
    });
  });

  it('runImport dispatches by type', async () => {
    prisma.productVariant.findUnique.mockResolvedValue(null);
    prisma.productVariant.findFirst.mockResolvedValue(null);
    createProduct.mockResolvedValue({ id: 'prod-1' });
    prisma.productVariant.create.mockResolvedValue({ id: 'var-1' });

    const csv = [
      'variant_id,product_id,title,sku,inventory_count,inventory_tracked,prices',
      ',,Another Product,,0,true,',
    ].join('\n');

    const result = await runImport('products', csv);
    expect(result.created).toBe(1);
  });
});
