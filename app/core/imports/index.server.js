// app/core/imports/index.server.js
// CSV import for products and customers (mirrors export formats).

import prisma from '#/libs/prisma.server';
import { createProduct } from '#/core/catalog/index.server';
import { buildCsv, csvCell } from '#/core/exports/index.server';

export const IMPORT_TYPES = ['products', 'customers'];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).filter(Boolean).map(parseCsvLine);
  return { headers, rows };
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? '';
  });
  return obj;
}

/**
 * Import products from export-compatible CSV.
 * Expected headers: variant_id, product_id, title, sku, inventory_count, inventory_tracked, prices
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
      if (data.product_id) {
        const variant = await prisma.productVariant.findFirst({
          where: { productId: data.product_id },
        });
        if (variant) {
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: data.sku || null,
              inventoryCount: Number(data.inventory_count) || 0,
              inventoryTracked: data.inventory_tracked !== 'false',
            },
          });
          results.updated += 1;
          continue;
        }
      }

      const product = await createProduct({
        title,
        productType: 'physical',
        locale: 'en',
      });

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: data.sku || null,
          inventoryCount: Number(data.inventory_count) || 0,
          inventoryTracked: data.inventory_tracked !== 'false',
        },
      });

      if (data.prices) {
        const pricePairs = String(data.prices).split(';').filter(Boolean);
        for (const pair of pricePairs) {
          const [currency, cents] = pair.split(':');
          if (!currency || !cents) continue;
          await prisma.variantPrice.upsert({
            where: {
              variantId_currency: { variantId: variant.id, currency },
            },
            create: {
              variantId: variant.id,
              currency,
              priceCents: Number(cents),
            },
            update: { priceCents: Number(cents) },
          });
        }
      }

      results.created += 1;
    } catch (err) {
      results.errors.push({ row, error: err.message });
    }
  }

  return results;
}

/**
 * Import customers CSV.
 * Expected headers: id, email, name, phone, created_at
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

    try {
      const existing = await prisma.customer.findUnique({ where: { email } });
      if (existing) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: data.name || existing.name,
            phone: data.phone || existing.phone,
          },
        });
        results.updated += 1;
      } else {
        await prisma.customer.create({
          data: {
            email,
            name: data.name || null,
            phone: data.phone || null,
            emailVerified: false,
          },
        });
        results.created += 1;
      }
    } catch (err) {
      results.errors.push({ row, error: err.message });
    }
  }

  return results;
}

export function productImportTemplateCsv() {
  return buildCsv(
    [
      'variant_id',
      'product_id',
      'title',
      'sku',
      'inventory_count',
      'inventory_tracked',
      'prices',
    ],
    [['', '', 'Sample Product', 'SKU-001', '10', 'true', 'USD:1999']]
  );
}

export function customerImportTemplateCsv() {
  return buildCsv(
    ['id', 'email', 'name', 'phone', 'created_at'],
    [['', 'customer@example.com', 'Jane Doe', '', '']]
  );
}

export { csvCell };
