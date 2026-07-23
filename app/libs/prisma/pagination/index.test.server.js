import { describe, expect, it } from 'vitest';

import {
  buildPaginationMeta,
  buildPrismaPagination,
  normalizePagination,
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination/index.server';

describe('prisma pagination', () => {
  it('reads params from URLSearchParams', () => {
    const params = new URLSearchParams('page=2&limit=25');
    expect(readQueryParam(params, 'page')).toBe('2');
    expect(readQueryParam(params, 'missing')).toBeUndefined();
  });

  it('reads params from plain objects', () => {
    expect(readQueryParam({ page: '3', empty: '' }, 'page')).toBe('3');
    expect(readQueryParam({ empty: '' }, 'empty')).toBeUndefined();
  });

  it('parses list pagination with defaults and caps', () => {
    expect(parseListPagination({}, { limit: 20, max: 100 })).toEqual({
      page: 1,
      limit: 20,
    });

    expect(
      parseListPagination(new URLSearchParams('page=0&limit=500'), {
        limit: 20,
        max: 100,
      })
    ).toEqual({ page: 1, limit: 100 });
  });

  it('normalizes page and limit values', () => {
    expect(
      normalizePagination({
        page: 0,
        limit: 0,
        defaultLimit: 50,
        maxLimit: 100,
      })
    ).toEqual({ page: 1, limit: 50 });
    expect(
      normalizePagination({
        page: 2,
        limit: 250,
        defaultLimit: 50,
        maxLimit: 100,
      })
    ).toEqual({ page: 2, limit: 100 });
  });

  it('builds prisma skip/take values', () => {
    expect(
      buildPrismaPagination({
        page: 3,
        limit: 10,
        defaultLimit: 20,
        maxLimit: 100,
      })
    ).toEqual({ page: 3, limit: 10, skip: 20, take: 10 });
  });

  it('builds pagination metadata', () => {
    expect(buildPaginationMeta({ page: 2, limit: 10, total: 25 })).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
    });
  });
});
