// app/libs/prisma/pagination.server.js
// Shared Prisma list pagination helpers.

export const DEFAULT_MAX_LIST_RESULTS = 100;

/**
 * Read a single query param from URLSearchParams or a plain object.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} source
 * @param {string} key
 * @returns {string|undefined}
 */
export function readQueryParam(source, key) {
  if (source instanceof URLSearchParams) {
    const value = source.get(key);
    return value === null || value === '' ? undefined : value;
  }

  const value = source[key];
  if (value === null || value === undefined || value === '') return undefined;
  return value.toString();
}

/**
 * Parse page/limit from list query params.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 * @param {{ limit?: number, max?: number }} [defaults]
 * @returns {{ page: number, limit: number }}
 */
export function parseListPagination(
  source = {},
  { limit: defaultLimit = 20, max = DEFAULT_MAX_LIST_RESULTS } = {}
) {
  const page = Math.max(
    1,
    parseInt(readQueryParam(source, 'page') ?? '1', 10) || 1
  );
  const limit = Math.min(
    Math.max(
      1,
      parseInt(readQueryParam(source, 'limit') ?? String(defaultLimit), 10) ||
        defaultLimit
    ),
    max
  );

  return { page, limit };
}

/**
 * Clamp page/limit values for list queries.
 *
 * @param {{ page?: number, limit?: number, defaultLimit?: number, maxLimit?: number }} [opts]
 * @returns {{ page: number, limit: number }}
 */
export function normalizePagination({
  page = 1,
  limit,
  defaultLimit = 20,
  maxLimit = DEFAULT_MAX_LIST_RESULTS,
} = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit || defaultLimit), maxLimit);

  return { page: safePage, limit: safeLimit };
}

/**
 * Build Prisma skip/take from page and limit.
 *
 * @param {{ page?: number, limit?: number, defaultLimit?: number, maxLimit?: number }} [opts]
 * @returns {{ page: number, limit: number, skip: number, take: number }}
 */
export function buildPrismaPagination(opts = {}) {
  const { page, limit } = normalizePagination(opts);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build standard pagination metadata for list responses.
 *
 * @param {{ page: number, limit: number, total: number }}
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
export function buildPaginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
