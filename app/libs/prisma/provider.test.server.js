// Covers provider detection used by createPrismaClient and CLI seed bootstrap.
import { afterEach, describe, expect, it } from 'vitest';

import { getDatabaseProvider, isPostgres } from './provider.server.js';

describe('getDatabaseProvider', () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalProvider = process.env.DATABASE_PROVIDER;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (originalProvider === undefined) delete process.env.DATABASE_PROVIDER;
    else process.env.DATABASE_PROVIDER = originalProvider;
  });

  it('defaults to sqlite for file URLs', () => {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    delete process.env.DATABASE_PROVIDER;
    expect(getDatabaseProvider()).toBe('sqlite');
    expect(isPostgres()).toBe(false);
  });

  it('detects postgresql from connection string', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/shop';
    delete process.env.DATABASE_PROVIDER;
    expect(getDatabaseProvider()).toBe('postgresql');
    expect(isPostgres()).toBe(true);
  });

  it('detects postgres:// scheme', () => {
    process.env.DATABASE_URL = 'postgres://localhost/db';
    delete process.env.DATABASE_PROVIDER;
    expect(getDatabaseProvider()).toBe('postgresql');
  });

  it('honors DATABASE_PROVIDER override', () => {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    process.env.DATABASE_PROVIDER = 'postgresql';
    expect(getDatabaseProvider()).toBe('postgresql');
  });
});
