## Cursor Cloud specific instructions

### Overview

bermooda is an ecommerce platform built with React Router 7 (SSR), Prisma 7 with SQLite, and Vite 7. It is a single-service monolith — no Docker, no external database server needed for development.

**Architecture layers:**
- `app/libs/*` = infrastructure (auth, db clients, queue, SDK wrappers)
- `app/core/*` = domain layer (catalog, cart, orders, payments, shipping, customers, etc.)
- `app/routes/*` = route modules
- `app/components/*` = reusable UI

### Running the dev server

The `npm run dev` script wraps with `op run` (1Password CLI), which is **not** available in Cloud Agent environments. Start the dev server directly:

```
npx react-router dev --port 3000 --host
```

A `.env` file must exist in the repo root (see `.env.example`). Placeholder values are fine for basic local development — the app starts and serves pages without real API keys for Stripe, Resend, etc.

### Key commands

| Task          | Command                                   |
| ------------- | ----------------------------------------- |
| Install deps  | `npm install`                             |
| Prisma setup  | `npm run setup` (generate + migrate)      |
| Dev server    | `npx react-router dev --port 3000 --host` |
| Lint          | `npm run lint` (oxlint + oxfmt --check)   |
| Format        | `npm run fmt`                             |
| Build         | `npm run build`                           |
| New migration | `npm run prisma:migrate -- --name <name>` |

### Non-obvious notes

- **No test framework** is configured in this repo. There are no unit or integration tests to run.
- The SQLite database file is created at `prisma/dev.db` on first `prisma migrate deploy`. Delete it and re-run `npm run setup` to reset.
- `prisma/generated/` is committed but must match the schema; always run `npx prisma generate` after pulling schema changes.
- Lint exit code 1 from pre-existing oxfmt formatting warnings is expected and not a sign of breakage.
- The `#/*` import alias maps to `./app/` (configured in `vite.config.js`).
