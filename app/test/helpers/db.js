// app/test/helpers/db.js
// Placeholder for future integration test DB helpers.
// All current tests use vi.mock for Prisma — this file is a stub.

/**
 * Returns a DATABASE_URL for tests. Falls back to a temp SQLite path
 * when DATABASE_URL_TEST is not set.
 */
export function getTestDatabaseUrl(workerId = '0') {
  return (
    process.env.DATABASE_URL_TEST ?? `file:/tmp/bermooda-test-${workerId}.db`
  );
}
