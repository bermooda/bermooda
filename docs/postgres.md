# Postgres deployment

bermooda defaults to **SQLite** for local development (`DATABASE_URL=file:./prisma/dev.db`). Production and CI can run on **PostgreSQL** using the same Prisma schema and application code.

## Environment variables

| Variable            | Default                | Description                                    |
| ------------------- | ---------------------- | ---------------------------------------------- |
| `DATABASE_URL`      | `file:./prisma/dev.db` | SQLite file path or Postgres connection string |
| `DATABASE_PROVIDER` | inferred from URL      | Optional override: `sqlite` or `postgresql`    |

Examples:

```bash
# Local SQLite (default)
DATABASE_URL="file:./prisma/dev.db"

# Postgres
DATABASE_URL="postgresql://user:pass@localhost:5432/bermooda"
DATABASE_PROVIDER="postgresql"
```

## Application wiring

- `app/libs/prisma/client.server.js` selects `@prisma/adapter-better-sqlite3` or `@prisma/adapter-pg` based on the provider.
- Better Auth adapters use the matching provider via `getBetterAuthProvider()` from `#/libs/prisma/provider/index.server`.
- Case-insensitive filters use `#/libs/prisma/filters/index.server` so queries work on both engines (`mode: 'insensitive'` is applied only on Postgres).

## CI / fresh Postgres database

1. Sync the schema provider:

   ```bash
   DATABASE_PROVIDER=postgresql node scripts/sync-prisma-provider.js
   ```

2. Push schema (recommended for ephemeral CI databases):

   ```bash
   npx prisma db push
   npx prisma generate
   ```

3. Run the app/tests against the Postgres URL.

For long-lived Postgres deployments, prefer `prisma migrate deploy` once migrations have been generated against the Postgres provider.

## Local Postgres (optional)

If you prefer Postgres locally, start a database and point `DATABASE_URL` at it. Keep `QUEUE_DATABASE_PATH` on SQLite unless you migrate the LiteQuu queue separately.
