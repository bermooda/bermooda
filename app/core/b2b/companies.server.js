// app/core/b2b/companies.server.js
// B2B company accounts: parse/serialize helpers and CRUD.

import prisma from '#/libs/prisma.server';
import { containsFilter } from '#/libs/prisma/filters/index.server';
import {
  buildPaginationMeta,
  buildPrismaPagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination/index.server';
import { serializeQuote } from '#/core/b2b/shared.server';

export const COMPANY_MEMBER_ROLES = ['buyer', 'admin'];

export const DEFAULT_COMPANY_LIST_LIMIT = 20;
export const MAX_COMPANY_LIST_RESULTS = 100;

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

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

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

function throwCompanyNotFound(companyId) {
  throw Object.assign(new Error('Company not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    companyId,
  });
}

/**
 * Load a company or throw NOT_FOUND.
 *
 * @param {string} companyId
 * @param {object|null} [include]
 */
export async function requireCompanyRecord(
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

/**
 * @param {string} id
 */
export async function getCompany(id) {
  const company = await requireCompanyRecord(id);
  return serializeCompany(company);
}

/**
 * @param {object} input
 */
export async function createCompany(input) {
  const data = parseCreateCompanyInput(input);
  const company = await prisma.company.create({ data });
  return serializeCompany(company);
}

/**
 * @param {object} input
 */
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
 * Customers for the company member picker in admin.
 *
 * @param {{ limit?: number }} [options]
 */
export async function listCustomersForCompanyForm({ limit = 100 } = {}) {
  return prisma.customer.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, name: true },
  });
}

/**
 * Load data for the admin companies index page.
 *
 * @param {object} [params]
 */
export async function loadCompanyAdminIndexData(params = {}) {
  const [{ companies, total, page, limit }, customers] = await Promise.all([
    listCompanies({ ...params, limit: params.limit ?? 100 }),
    listCustomersForCompanyForm(),
  ]);

  return { companies, total, page, limit, customers };
}
