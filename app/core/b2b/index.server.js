// app/core/b2b/index.server.js
// B2B company accounts and quote workflow.

import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination.server';

export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'accepted',
  'expired',
  'cancelled',
];

export const COMPANY_MEMBER_ROLES = ['buyer', 'admin'];

export const DEFAULT_COMPANY_LIST_LIMIT = 20;
export const MAX_COMPANY_LIST_RESULTS = 100;
export const DEFAULT_QUOTE_LIST_LIMIT = 20;
export const MAX_QUOTE_LIST_RESULTS = 100;

const QUOTE_STATUS_SET = new Set(QUOTE_STATUSES);
const COMPANY_MEMBER_ROLE_SET = new Set(COMPANY_MEMBER_ROLES);

const COMPANY_LIST_INCLUDE = {
  _count: { select: { members: true, quotes: true } },
};

const COMPANY_DETAIL_INCLUDE = {
  members: {
    include: {
      customer: { select: { id: true, email: true, name: true } },
    },
  },
  quotes: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      _count: { select: { lines: true } },
    },
  },
  _count: { select: { members: true, quotes: true } },
};

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
 * Parse company list query params from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @returns {{ page: number, limit: number, q?: string, active?: boolean }}
 */
export function parseCompanyListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_COMPANY_LIST_LIMIT,
    max: MAX_COMPANY_LIST_RESULTS,
  });
  const q = readQueryParam(source, 'q')?.trim();
  const active = readQueryParam(source, 'active');

  return {
    page,
    limit,
    ...(q ? { q } : {}),
    ...(active === 'true' || active === 'false'
      ? { active: active === 'true' }
      : {}),
  };
}

/**
 * Build a Prisma where clause for company list filters.
 *
 * @param {{ q?: string, active?: boolean }} filters
 */
export function buildCompanyWhere({ q, active } = {}) {
  const where = {};
  const query = q?.trim();
  if (query) {
    where.OR = [
      { name: containsFilter(query) },
      { taxId: containsFilter(query) },
    ];
  }
  if (active !== undefined) {
    where.active = active;
  }
  return where;
}

/**
 * Parse create-company payload from admin/API input.
 *
 * @param {object} input
 */
export function parseCreateCompanyInput(input = {}) {
  const name = input.name?.toString().trim();
  const taxId = input.taxId?.toString().trim() || null;
  const netTermsDays =
    input.netTermsDays == null || input.netTermsDays === ''
      ? 30
      : typeof input.netTermsDays === 'number'
        ? input.netTermsDays
        : parseInt(String(input.netTermsDays), 10);
  const active =
    input.active === undefined
      ? true
      : input.active === true ||
        input.active === 'on' ||
        input.active === 'true';

  if (!name) {
    throw Object.assign(new Error('Company name is required.'), {
      code: 'NAME_REQUIRED',
    });
  }

  if (!Number.isFinite(netTermsDays) || netTermsDays < 0) {
    throw Object.assign(new Error('Net terms days must be a number.'), {
      code: 'NET_TERMS_INVALID',
    });
  }

  return { name, taxId, netTermsDays, active };
}

/**
 * Parse add-company-member payload from admin/API input.
 *
 * @param {object} input
 */
export function parseAddCompanyMemberInput(input = {}) {
  const companyId = input.companyId?.toString().trim();
  const customerId = input.customerId?.toString().trim();
  const role = input.role?.toString().trim() || 'buyer';

  if (!companyId) {
    throw Object.assign(new Error('companyId is required.'), {
      code: 'COMPANY_ID_REQUIRED',
    });
  }

  if (!customerId) {
    throw Object.assign(new Error('customerId is required.'), {
      code: 'CUSTOMER_ID_REQUIRED',
    });
  }

  if (!COMPANY_MEMBER_ROLE_SET.has(role)) {
    throw Object.assign(new Error('Invalid company member role.'), {
      code: 'ROLE_INVALID',
    });
  }

  return { companyId, customerId, role };
}

/**
 * Parse create-company form submission.
 *
 * @param {FormData} formData
 */
export function parseCreateCompanyForm(formData) {
  return parseCreateCompanyInput({
    name: formData.get('name'),
    taxId: formData.get('taxId'),
    netTermsDays: formData.get('netTermsDays'),
  });
}

/**
 * Parse add-company-member form submission.
 *
 * @param {FormData} formData
 */
export function parseAddCompanyMemberForm(formData) {
  return parseAddCompanyMemberInput({
    companyId: formData.get('companyId'),
    customerId: formData.get('customerId'),
    role: formData.get('role'),
  });
}

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

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Format cents as a localized currency string.
 *
 * @param {number} cents
 * @param {string} [currency]
 */
export function formatQuoteMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Serialize a company for admin/API responses.
 *
 * @param {object} record
 */
export function serializeCompany(record) {
  return {
    id: record.id,
    name: record.name,
    taxId: record.taxId ?? null,
    netTermsDays: record.netTermsDays,
    active: record.active ?? true,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    memberCount: record._count?.members ?? record.members?.length ?? undefined,
    quoteCount: record._count?.quotes ?? record.quotes?.length ?? undefined,
    members: record.members?.map((member) => ({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt?.toISOString?.() ?? member.createdAt,
      customer: member.customer
        ? {
            id: member.customer.id,
            email: member.customer.email,
            name: member.customer.name ?? null,
          }
        : undefined,
    })),
    quotes: record.quotes?.map(serializeQuote),
  };
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

function nextQuoteNumber() {
  return `QUO-${Date.now()}`;
}

function throwCompanyNotFound(companyId) {
  throw Object.assign(new Error('Company not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    companyId,
  });
}

function throwQuoteNotFound(quoteId) {
  throw Object.assign(new Error('Quote not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    quoteId,
  });
}

async function requireCompanyRecord(
  companyId,
  include = COMPANY_DETAIL_INCLUDE
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include,
  });
  if (!company) throwCompanyNotFound(companyId);
  return company;
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
 * List companies with optional search and pagination.
 *
 * @param {object} [options]
 * @returns {Promise<{ companies: object[], total: number, page: number, limit: number, totalPages: number }>}
 */
export async function listCompanies(options = {}) {
  const params =
    options.page != null || options.limit != null
      ? options
      : parseCompanyListParams(options);

  const {
    page: safePage,
    limit: safeLimit,
    skip,
    take,
  } = buildPrismaPagination({
    page: params.page,
    limit: params.limit,
    defaultLimit: DEFAULT_COMPANY_LIST_LIMIT,
    maxLimit: MAX_COMPANY_LIST_RESULTS,
  });
  const where = buildCompanyWhere(params);

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      include: COMPANY_LIST_INCLUDE,
      orderBy: { name: 'asc' },
      skip,
      take,
    }),
    prisma.company.count({ where }),
  ]);

  return {
    companies: items.map(serializeCompany),
    ...buildPaginationMeta({ page: safePage, limit: safeLimit, total }),
  };
}

export async function getCompany(id) {
  const company = await requireCompanyRecord(id);
  return serializeCompany(company);
}

export async function createCompany(input) {
  const data = parseCreateCompanyInput(input);
  const company = await prisma.company.create({ data });
  return serializeCompany(company);
}

export async function addCompanyMember(input) {
  const { companyId, customerId, role } = parseAddCompanyMemberInput(input);

  await requireCompanyRecord(companyId, {
    _count: { select: { members: true } },
  });

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

  const existing = await prisma.companyMember.findUnique({
    where: {
      companyId_customerId: { companyId, customerId },
    },
  });
  if (existing) {
    throw Object.assign(new Error('Customer is already a company member.'), {
      code: 'MEMBER_EXISTS',
    });
  }

  const member = await prisma.companyMember.create({
    data: { companyId, customerId, role },
    include: {
      customer: { select: { id: true, email: true, name: true } },
    },
  });

  return {
    id: member.id,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
    customer: {
      id: member.customer.id,
      email: member.customer.email,
      name: member.customer.name ?? null,
    },
  };
}

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

export async function getQuote(id) {
  const quote = await requireQuoteRecord(id);
  return serializeQuote(quote);
}

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

export async function sendQuote(id) {
  return updateQuoteStatus(id, { status: 'sent' });
}

export async function acceptQuote(id, orderId) {
  return updateQuoteStatus(id, { status: 'accepted', orderId });
}

// ---------------------------------------------------------------------------
// Admin page loaders
// ---------------------------------------------------------------------------

/**
 * Customers for the company member picker in admin.
 */
export async function listCustomersForCompanyForm({ limit = 100 } = {}) {
  return prisma.customer.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, name: true },
  });
}

/**
 * Variants for the quote line picker in admin.
 */
export async function listVariantsForQuoteForm({ limit = 30 } = {}) {
  return prisma.productVariant.findMany({
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: { product: true, prices: true },
  });
}

/**
 * Load data for the admin companies index page.
 */
export async function loadCompanyAdminIndexData(params = {}) {
  const [{ companies, total, page, limit }, customers] = await Promise.all([
    listCompanies({ ...params, limit: params.limit ?? 100 }),
    listCustomersForCompanyForm(),
  ]);

  return { companies, total, page, limit, customers };
}

/**
 * Load data for the admin quotes index page.
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
