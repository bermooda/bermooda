// app/core/imports/index.server.js
// CSV import for products and customers (mirrors export formats).

import prisma from '#/libs/prisma.server';
import { createProduct, updateProduct } from '#/core/catalog/index.server';
import { createCustomer, updateCustomer } from '#/core/customers/index.server';
import { buildCsv, parseCsv, rowToObject } from '#/core/exports/index.server';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';

export const IMPORT_TYPES = ['products', 'customers'];

export const PRODUCT_IMPORT_HEADERS = [
  'variant_id',
  'product_id',
  'title',
  'sku',
  'inventory_count',
  'inventory_tracked',
  'prices',
];

export const CUSTOMER_IMPORT_HEADERS = [
  'id',
  'email',
  'name',
  'phone',
  'preferred_locale',
  'created_at',
];

/**
 * Validate an import type.
 *
 * @param {string} importType
 */
export function validateImportType(importType) {
  if (!IMPORT_TYPES.includes(importType)) {
    throw Object.assign(new Error('Invalid import type'), {
      code: 'INVALID_IMPORT_TYPE',
    });
  }
}

/**
 * Parse admin/API import payload.
 *
 * @param {object} input
 * @returns {{ type: string, csv: string }}
 */
export function parseImportInput(input = {}) {
  const type = input.type?.toString().trim() ?? '';
  const csv = input.csv?.toString() ?? '';

  if (!type || !csv.trim()) {
    throw Object.assign(new Error('Import type and CSV content are required'), {
      code: 'FIELDS_REQUIRED',
    });
  }

  validateImportType(type);
  return { type, csv };
}

/**
 * Serialize import results for admin/API responses.
 *
 * @param {object} result
 */
export function serializeImportResult(result) {
  return {
    created: result.created,
    updated: result.updated,
    errors: result.errors.map(({ row, error }) => ({
      row,
      error,
    })),
  };
}

/**
 * Resolve a downloadable import template CSV.
 *
 * @param {string} type
 * @returns {{ csv: string, filename: string }}
 */
export function resolveImportTemplate(type) {
  validateImportType(type);

  if (type === 'products') {
    return {
      csv: buildCsv(PRODUCT_IMPORT_HEADERS, [
        ['', '', 'Sample Product', 'SKU-001', '10', 'true', 'USD:1999'],
      ]),
      filename: 'product-import-template.csv',
    };
  }

  return {
    csv: buildCsv(CUSTOMER_IMPORT_HEADERS, [
      ['', 'customer@example.com', 'Jane Doe', '', DEFAULT_LOCALE, ''],
    ]),
    filename: 'customer-import-template.csv',
  };
}

/**
 * Run a CSV import by type.
 *
 * @param {string} type
 * @param {string} csvText
 */
export async function runImport(type, csvText) {
  validateImportType(type);

  if (type === 'products') {
    return importProductsCsv(csvText);
  }

  return importCustomersCsv(csvText);
}

/**
 * Parse a semicolon-separated prices field (e.g. "USD:1999;EUR:1500").
 *
 * @param {string} raw
 * @returns {{ currency: string, priceCents: number }[]}
 */
export function parseImportPricesField(raw) {
  if (!raw?.trim()) return [];

  return String(raw)
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [currency, cents] = pair.split(':');
      if (!currency || cents === undefined || cents === '') return null;
      const priceCents = Number(cents);
      if (!Number.isFinite(priceCents)) return null;
      return { currency: currency.trim().toUpperCase(), priceCents };
    })
    .filter(Boolean);
}

/**
 * Upsert variant prices from an import row.
 *
 * @param {string} variantId
 * @param {string} rawPrices
 */
async function upsertVariantPrices(variantId, rawPrices) {
  const prices = parseImportPricesField(rawPrices);
  for (const { currency, priceCents } of prices) {
    await prisma.variantPrice.upsert({
      where: {
        variantId_currency: { variantId, currency },
      },
      create: {
        variantId,
        currency,
        priceCents,
      },
      update: { priceCents },
    });
  }
}

/**
 * Import products from export-compatible CSV.
 */
export async function importProductsCsv(csvText) {
  const { headers, rows } = parseCsv(csvText);
  const results = { created: 0, updated: 0, errors: [] };

  for (const row of rows) {
    const data = rowToObject(headers, row);
    const title = data.title?.trim();
    if (!title) {
      results.errors.push({ row, error: 'Missing title' });
      continue;
    }

    try {
      const variantId = data.variant_id?.trim();
      const productId = data.product_id?.trim();
      const variantData = {
        sku: data.sku?.trim() || null,
        inventoryCount: Number(data.inventory_count) || 0,
        inventoryTracked: data.inventory_tracked !== 'false',
      };

      let variant = null;
      if (variantId) {
        variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
        });
      } else if (productId) {
        variant = await prisma.productVariant.findFirst({
          where: { productId },
          orderBy: { position: 'asc' },
        });
      }

      if (variant) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: variantData,
        });
        await upsertVariantPrices(variant.id, data.prices);
        await updateProduct(variant.productId, {
          title,
          locale: DEFAULT_LOCALE,
        });
        results.updated += 1;
        continue;
      }

      const product = await createProduct({
        title,
        productType: 'physical',
        locale: DEFAULT_LOCALE,
      });

      const createdVariant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          ...variantData,
        },
      });

      await upsertVariantPrices(createdVariant.id, data.prices);
      results.created += 1;
    } catch (err) {
      results.errors.push({ row, error: err.message });
    }
  }

  return results;
}

/**
 * Import customers CSV.
 */
export async function importCustomersCsv(csvText) {
  const { headers, rows } = parseCsv(csvText);
  const results = { created: 0, updated: 0, errors: [] };

  for (const row of rows) {
    const data = rowToObject(headers, row);
    const email = data.email?.trim().toLowerCase();
    if (!email) {
      results.errors.push({ row, error: 'Missing email' });
      continue;
    }

    const profile = {
      name: data.name?.trim() || null,
      phone: data.phone?.trim() || null,
      preferredLocale: data.preferred_locale?.trim() || null,
    };

    try {
      const customerId = data.id?.trim();
      let existing = customerId
        ? await prisma.customer.findUnique({ where: { id: customerId } })
        : null;

      if (!existing) {
        existing = await prisma.customer.findUnique({ where: { email } });
      }

      if (existing) {
        await updateCustomer(existing.id, profile);
        results.updated += 1;
      } else {
        await createCustomer({
          email,
          name: profile.name,
          phone: profile.phone,
          preferredLocale: profile.preferredLocale,
        });
        results.created += 1;
      }
    } catch (err) {
      results.errors.push({ row, error: err.message });
    }
  }

  return results;
}
