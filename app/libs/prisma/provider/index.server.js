// app/libs/prisma/provider/index.server.js
// Detect the active database provider from environment configuration.

/**
 * Resolve the database provider from env or DATABASE_URL.
 *
 * @returns {'sqlite' | 'postgresql'}
 */
export function getDatabaseProvider() {
  const explicit = process.env.DATABASE_PROVIDER?.trim().toLowerCase();
  if (explicit === 'postgresql' || explicit === 'postgres') {
    return 'postgresql';
  }
  if (explicit === 'sqlite') {
    return 'sqlite';
  }

  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql';
  }

  return 'sqlite';
}

/** @returns {boolean} */
export function isPostgres() {
  return getDatabaseProvider() === 'postgresql';
}

/** Provider string for Better Auth prisma adapter. */
export function getBetterAuthProvider() {
  return isPostgres() ? 'postgresql' : 'sqlite';
}
