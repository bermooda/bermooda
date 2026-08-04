// app/core/b2b/shared.server.js
// Shared quote serialization helpers (used by companies nested quotes + quotes module).

/**
 * Format cents as a localized currency string.
 *
 * @param {number} cents
 * @param {string} [currency]
 * @returns {string}
 */
export function formatQuoteMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Serialize a quote line for admin/API responses.
 *
 * @param {object} record
 */
export function serializeQuoteLine(record) {
  return {
    id: record.id,
    variantId: record.variantId,
    quantity: record.quantity,
    priceCents: record.priceCents,
    titleSnapshot: record.titleSnapshot ?? null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    variant: record.variant
      ? {
          id: record.variant.id,
          sku: record.variant.sku ?? null,
          productTitle: record.variant.product?.title ?? null,
        }
      : undefined,
  };
}

/**
 * Serialize a quote for admin/API responses.
 *
 * @param {object} record
 */
export function serializeQuote(record) {
  return {
    id: record.id,
    quoteNumber: record.quoteNumber,
    companyId: record.companyId,
    customerId: record.customerId ?? null,
    status: record.status,
    currency: record.currency,
    subtotalCents: record.subtotalCents,
    totalCents: record.totalCents,
    notes: record.notes ?? null,
    orderId: record.orderId ?? null,
    expiresAt: record.expiresAt?.toISOString?.() ?? record.expiresAt ?? null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    lineCount: record._count?.lines ?? record.lines?.length ?? undefined,
    company: record.company
      ? {
          id: record.company.id,
          name: record.company.name,
          netTermsDays: record.company.netTermsDays ?? undefined,
        }
      : undefined,
    customer: record.customer
      ? {
          id: record.customer.id,
          email: record.customer.email,
          name: record.customer.name ?? null,
        }
      : undefined,
    lines: record.lines?.map(serializeQuoteLine),
    formattedTotal: formatQuoteMoney(record.totalCents, record.currency),
  };
}
