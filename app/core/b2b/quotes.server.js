// app/core/b2b/quotes.server.js
// B2B quote workflow: parse/serialize helpers and CRUD/status transitions.

import prisma from '#/libs/prisma.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination/index.server';
import {
  listCompanies,
  requireCompanyRecord,
} from '#/core/b2b/companies.server';
import {
  formatQuoteMoney,
  serializeQuote,
  serializeQuoteLine,
} from '#/core/b2b/shared.server';

export { formatQuoteMoney, serializeQuote, serializeQuoteLine };

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'expired',
  'cancelled',
];

export const DEFAULT_QUOTE_LIST_LIMIT = 20;
export const MAX_QUOTE_LIST_RESULTS = 100;

const QUOTE_STATUS_SET = new Set(QUOTE_STATUSES);

const QUOTE_LIST_INCLUDE = {
  company: { select: { id: true, name: true } },
  customer: { select: { id: true, email: true, name: true } },
  _count: { select: { lines: true } },
};

const QUOTE_DETAIL_INCLUDE = {
  company: { select: { id: true, name: true, netTermsDays: true } },
  customer: { select: { id: true, email: true, name: true } },
  lines: {
    include: {
      variant: {
        include: { product: true, prices: true },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse quote list query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {{ page: number, limit: number, companyId?: string, customerId?: string, status?: string }}
 */
export function parseQuoteListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_QUOTE_LIST_LIMIT,
    max: MAX_QUOTE_LIST_RESULTS,
  });

  const companyId = readQueryParam(source, 'companyId')?.trim();
  const customerId = readQueryParam(source, 'customerId')?.trim();
  const status = readQueryParam(source, 'status')?.trim();

  if (status && !QUOTE_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid quote status filter.'), {
      code: 'INVALID_QUOTE_STATUS',
    });
  }

  return {
    page,
    limit,
    ...(companyId ? { companyId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(status ? { status } : {}),
  };
}

/**
 * Build a Prisma where clause for quote list filters.
 *
 * @param {{ companyId?: string, customerId?: string, status?: string }} filters
 */
export function buildQuoteWhere({ companyId, customerId, status } = {}) {
  const where = {};
  if (companyId) where.companyId = companyId;
  if (customerId) where.customerId = customerId;
  if (status) where.status = status;
  return where;
}

/**
 * Parse quote line payloads.
 *
 * @param {Array<{ variantId: string, quantity: number, priceCents: number, titleSnapshot?: string|null }>} lines
 */
export function parseQuoteLinesInput(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw Object.assign(new Error('Quote lines are required.'), {
      code: 'QUOTE_LINES_REQUIRED',
    });
  }

  return lines.map((line) => {
    const variantId = line.variantId?.toString().trim();
    const quantity =
      typeof line.quantity === 'number'
        ? line.quantity
        : parseInt(String(line.quantity ?? '0'), 10);
    const priceCents =
      typeof line.priceCents === 'number'
        ? line.priceCents
        : parseInt(String(line.priceCents ?? '0'), 10);
    const titleSnapshot = line.titleSnapshot?.toString().trim() || null;

    if (!variantId || !Number.isFinite(quantity) || quantity < 1) {
      throw Object.assign(new Error('Invalid quote line.'), {
        code: 'INVALID_QUOTE_LINE',
      });
    }

    if (!Number.isFinite(priceCents) || priceCents < 0) {
      throw Object.assign(new Error('Invalid quote line price.'), {
        code: 'INVALID_QUOTE_LINE_PRICE',
      });
    }

    return { variantId, quantity, priceCents, titleSnapshot };
  });
}

/**
 * Parse create-quote payload from admin/API input.
 *
 * @param {object} input
 */
export function parseCreateQuoteInput(input = {}) {
  const companyId = input.companyId?.toString().trim();
  const customerId = input.customerId?.toString().trim() || null;
  const currency = input.currency?.toString().trim().toUpperCase() || 'USD';
  const notes = input.notes?.toString().trim() || null;
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  const lines = parseQuoteLinesInput(input.lines);

  if (!companyId) {
    throw Object.assign(new Error('companyId is required.'), {
      code: 'COMPANY_ID_REQUIRED',
    });
  }

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw Object.assign(new Error('expiresAt must be a valid date.'), {
      code: 'EXPIRES_AT_INVALID',
    });
  }

  return {
    companyId,
    customerId,
    currency,
    notes,
    expiresAt,
    lines,
  };
}

/**
 * Parse create-quote form submission (single-line admin form).
 *
 * @param {FormData} formData
 */
export function parseCreateQuoteForm(formData) {
  return parseCreateQuoteInput({
    companyId: formData.get('companyId'),
    customerId: formData.get('customerId'),
    currency: formData.get('currency'),
    notes: formData.get('notes'),
    lines: [
      {
        variantId: formData.get('variantId'),
        quantity: formData.get('quantity'),
        priceCents: formData.get('priceCents'),
      },
    ],
  });
}

/**
 * Parse quote status update payload.
 *
 * @param {object} input
 */
export function parseUpdateQuoteStatusInput(input = {}) {
  const status = input.status?.toString().trim();
  if (!status || !QUOTE_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid quote status.'), {
      code: 'INVALID_QUOTE_STATUS',
    });
  }

  const orderId = input.orderId?.toString().trim() || null;
  return { status, orderId };
}

function nextQuoteNumber() {
  return `QUO-${Date.now()}`;
}

function throwQuoteNotFound(quoteId) {
  throw Object.assign(new Error('Quote not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    quoteId,
  });
}

async function requireQuoteRecord(quoteId, include = QUOTE_DETAIL_INCLUDE) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    ...(include ? { include } : {}),
  });
  if (!quote) throwQuoteNotFound(quoteId);
  return quote;
}

async function hydrateQuoteLineSnapshots(lines) {
  const hydrated = [...lines];

  for (const line of hydrated) {
    if (line.titleSnapshot) continue;

    const variant = await prisma.productVariant.findUnique({
      where: { id: line.variantId },
      include: { product: true },
    });

    if (!variant) {
      throw Object.assign(new Error('Variant not found.'), {
        code: 'VARIANT_NOT_FOUND',
        variantId: line.variantId,
      });
    }

    line.titleSnapshot =
      variant.product?.title ?? variant.sku ?? line.variantId;
  }

  return hydrated;
}

// ---------------------------------------------------------------------------
// Queries and mutations
// ---------------------------------------------------------------------------

/**
 * List quotes with optional filters and pagination.
 *
 * @param {object} [options]
 * @returns {Promise<{ quotes: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listQuotes(options = {}) {
  const params =
    options.page != null || options.limit != null
      ? options
      : parseQuoteListParams(options);

  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_QUOTE_LIST_LIMIT,
    maxLimit: MAX_QUOTE_LIST_RESULTS,
  });
  const where = buildQuoteWhere(params);

  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: QUOTE_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.quote.count({ where }),
  ]);

  return {
    quotes: items.map(serializeQuote),
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

/**
 * @param {string} id
 */
export async function getQuote(id) {
  const quote = await requireQuoteRecord(id);
  return serializeQuote(quote);
}

/**
 * @param {object} input
 */
export async function createQuote(input) {
  const { companyId, customerId, currency, notes, expiresAt, lines } =
    parseCreateQuoteInput(input);

  await requireCompanyRecord(companyId, {
    _count: { select: { quotes: true } },
  });

  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw Object.assign(new Error('Customer not found.'), {
        code: 'CUSTOMER_NOT_FOUND',
        customerId,
      });
    }
  }

  const hydratedLines = await hydrateQuoteLineSnapshots(lines);
  let subtotalCents = 0;

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        quoteNumber: nextQuoteNumber(),
        companyId,
        customerId,
        currency,
        notes,
        expiresAt,
        status: 'draft',
      },
    });

    for (const line of hydratedLines) {
      const lineTotal = line.priceCents * line.quantity;
      subtotalCents += lineTotal;

      await tx.quoteLine.create({
        data: {
          quoteId: created.id,
          variantId: line.variantId,
          quantity: line.quantity,
          priceCents: line.priceCents,
          titleSnapshot: line.titleSnapshot,
        },
      });
    }

    return tx.quote.update({
      where: { id: created.id },
      data: { subtotalCents, totalCents: subtotalCents },
    });
  });

  return getQuote(quote.id);
}

/**
 * @param {string} id
 * @param {object} input
 */
export async function updateQuoteStatus(id, input) {
  const { status, orderId } = parseUpdateQuoteStatusInput(input);
  await requireQuoteRecord(id, null);

  const quote = await prisma.quote.update({
    where: { id },
    data: {
      status,
      ...(orderId ? { orderId } : {}),
    },
    include: QUOTE_DETAIL_INCLUDE,
  });

  return serializeQuote(quote);
}

/**
 * @param {string} id
 */
export async function sendQuote(id) {
  return updateQuoteStatus(id, { status: 'sent' });
}

/**
 * @param {string} id
 * @param {string} [orderId]
 */
export async function acceptQuote(id, orderId) {
  return updateQuoteStatus(id, { status: 'accepted', orderId });
}

/**
 * Variants for the quote line picker in admin.
 *
 * @param {{ limit?: number }} [options]
 */
export async function listVariantsForQuoteForm({ limit = 30 } = {}) {
  return prisma.productVariant.findMany({
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: { product: true, prices: true },
  });
}

/**
 * Load data for the admin quotes index page.
 *
 * @param {object} [params]
 */
export async function loadQuoteAdminIndexData(params = {}) {
  const [{ quotes, total, page, limit }, companies, variants] =
    await Promise.all([
      listQuotes({ ...params, limit: params.limit ?? 100 }),
      listCompanies({ limit: 100 }),
      listVariantsForQuoteForm(),
    ]);

  return {
    quotes,
    companies: companies.companies,
    variants,
    total,
    page,
    limit,
  };
}
