import { PrismaClient } from '#prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

/**
 * Re-export Prisma model types
 * @typedef {import('#prisma/client').User} User
 * @typedef {import('#prisma/client').Session} Session
 * @typedef {import('#prisma/client').Account} Account
 * @typedef {import('#prisma/client').Verification} Verification
 * @typedef {import('#prisma/client').TwoFactor} TwoFactor
 */

/**
 * Create Prisma client with SQLite adapter
 * @see https://pris.ly/d/prisma7-client-config
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl,
  });

  return new PrismaClient({ adapter });
}

/** @type {PrismaClient} */
const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  if (!global.prisma) {
    global.prisma = prisma;
  }
}

export default prisma;
