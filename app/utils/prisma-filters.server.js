// app/utils/prisma-filters.server.js
// Cross-database Prisma filter helpers (SQLite vs Postgres case sensitivity).

import { isPostgres } from '#/utils/database.server';

/**
 * Build a case-insensitive `contains` filter when supported.
 *
 * @param {string} value
 */
export function containsFilter(value) {
  const filter = { contains: value };
  if (isPostgres()) {
    filter.mode = 'insensitive';
  }
  return filter;
}

/**
 * Build a case-insensitive `equals` filter when supported.
 *
 * @param {string} value
 */
export function equalsFilter(value) {
  const filter = { equals: value };
  if (isPostgres()) {
    filter.mode = 'insensitive';
  }
  return filter;
}
