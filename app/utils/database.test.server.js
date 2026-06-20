// app/utils/database.test.server.js

import { afterEach, describe, expect, it } from 'vitest';

import {
  getBetterAuthProvider,
  getDatabaseProvider,
  isPostgres,
} from '#/utils/database.server';

describe('database provider', () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalProvider = process.env.DATABASE_PROVIDER;

  afterEach(() => {
    process.env.DATABASE_URL = originalUrl;
    process.env.DATABASE_PROVIDER = originalProvider;
  });

  it('detects sqlite from file URL', () => {
    process.env.DATABASE_URL = 'file:./prisma/dev.db';
    delete process.env.DATABASE_PROVIDER;
    expect(getDatabaseProvider()).toBe('sqlite');
    expect(isPostgres()).toBe(false);
    expect(getBetterAuthProvider()).toBe('sqlite');
  });

  it('detects postgres from connection string', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    delete process.env.DATABASE_PROVIDER;
    expect(getDatabaseProvider()).toBe('postgresql');
    expect(isPostgres()).toBe(true);
    expect(getBetterAuthProvider()).toBe('postgresql');
  });
});
