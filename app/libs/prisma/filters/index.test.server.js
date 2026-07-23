import { afterEach, describe, expect, it } from 'vitest';

import {
  containsFilter,
  equalsFilter,
} from '#/libs/prisma/filters/index.server';

describe('prisma filters', () => {
  const originalProvider = process.env.DATABASE_PROVIDER;

  afterEach(() => {
    process.env.DATABASE_PROVIDER = originalProvider;
  });

  it('builds contains filter without mode on sqlite', () => {
    process.env.DATABASE_PROVIDER = 'sqlite';
    expect(containsFilter('Summer')).toEqual({ contains: 'Summer' });
  });

  it('builds contains filter with insensitive mode on postgres', () => {
    process.env.DATABASE_PROVIDER = 'postgresql';
    expect(containsFilter('Summer')).toEqual({
      contains: 'Summer',
      mode: 'insensitive',
    });
  });

  it('builds equals filter without mode on sqlite', () => {
    process.env.DATABASE_PROVIDER = 'sqlite';
    expect(equalsFilter('SAVE10')).toEqual({ equals: 'SAVE10' });
  });

  it('builds equals filter with insensitive mode on postgres', () => {
    process.env.DATABASE_PROVIDER = 'postgresql';
    expect(equalsFilter('SAVE10')).toEqual({
      equals: 'SAVE10',
      mode: 'insensitive',
    });
  });
});
