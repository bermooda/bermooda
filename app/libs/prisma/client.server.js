import { PrismaClient } from '#/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import { getDatabaseProvider } from '#/libs/prisma/provider/index.server';

/**
 * Re-export Prisma model types
 * @typedef {import('#/generated/prisma/client').User} User
 * @typedef {import('#/generated/prisma/client').Session} Session
 * @typedef {import('#/generated/prisma/client').Account} Account
 * @typedef {import('#/generated/prisma/client').Verification} Verification
 * @typedef {import('#/generated/prisma/client').TwoFactor} TwoFactor
 */

/**
 * Create Prisma client with the adapter matching DATABASE_URL / DATABASE_PROVIDER.
 * @see https://pris.ly/d/prisma7-client-config
 */
export function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  const provider = getDatabaseProvider();

  if (provider === 'postgresql') {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }

  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });
}

/** @type {PrismaClient} */
const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  if (!global.prisma) {
    global.prisma = prisma;
  }
}

export default prisma;
