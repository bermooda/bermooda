## Cursor Cloud specific instructions

### Overview

bermooda is an open-source ecommerce platform built with React Router 7 (SSR), Prisma 7 with SQLite, and Vite 8. It is a single-service monolith — no Docker, no external database server needed for development. One app serves the themed storefront, merchant admin, and REST API.

### Cloud Agent environment

The checked-in [`.cursor/environment.json`](.cursor/environment.json) configures the Cloud Agent install step. On each agent startup, Cursor runs [`.cursor/cloud-agent-install.sh`](.cursor/cloud-agent-install.sh), which:

1. Copies [`.env.example`](.env.example) to `.env` when `.env` is missing (Prisma requires `DATABASE_URL` at setup time).
2. Runs `npm install --legacy-peer-deps`.
3. Runs `npm run setup` (Prisma generate + migrate deploy).

The install script is idempotent and safe to run repeatedly. To reset the local database, delete `prisma/dev.db` and re-run `npm run setup`.

**Architecture layers:**

- `app/libs/*` = infrastructure (auth, db clients, queue, SDK wrappers, alerting)
- `app/core/*` = domain layer (catalog, cart, orders, payments, shipping, customers, etc.)
- `app/routes/*` = route modules (storefront, admin, API, webhooks, auth)
- `app/components/*` = reusable UI (admin shell, auth, landing, ui primitives)
- `app/themes/*` = storefront theme components (active theme renders the shop)
- `app/plugins/*` = hook-based extensions (blocks, admin pages, providers)

**Do not add new ecommerce domain code under `app/services`.** Use `app/core/*` instead. See [.cursor/rules/ecommerce-architecture.mdc](.cursor/rules/ecommerce-architecture.mdc).

**Further docs:** [docs/auth.md](docs/auth.md) (dual admin/customer auth), [docs/themes.md](docs/themes.md), [docs/plugins.md](docs/plugins.md), [docs/api.md](docs/api.md).

### Running the dev server

The `npm run dev` script wraps with `op run` (1Password CLI), which is **not** available in Cloud Agent environments. Start the dev server directly:

```
npx react-router dev --host
```

Port comes from `PORT` (default `3000`) via Vite `server.port` / `#/core/config` — set `PORT=4000` to change it. `strictPort` is enabled so a busy port fails instead of silently binding another one.

A `.env` file must exist in the repo root (see `.env.example`). Placeholder values are fine for basic local development — the app starts and serves pages without real API keys for Stripe, Resend, etc.

### Key commands

| Task          | Command                                   |
| ------------- | ----------------------------------------- |
| Install deps  | `npm install`                             |
| Prisma setup  | `npm run setup` (generate + migrate)      |
| Dev server    | `npx react-router dev --host`             |
| Lint          | `npm run lint` (oxlint + oxfmt --check)   |
| Format        | `npm run fmt`                             |
| Build         | `npm run build`                           |
| Tests         | `npm run test`                            |
| New migration | `npm run prisma:migrate -- --name <name>` |

### Non-obvious notes

- **Vitest** (`vitest.config.js`) runs two projects: `unit` (happy-dom) and `server` (Node). Shared setup is `app/test-setup.js`. Use `npm run test`, `npm run test:watch`, or `npm run test:coverage`.
- The SQLite database file is created at `prisma/dev.db` on first `prisma migrate deploy`. Delete it and re-run `npm run setup` to reset.
- `prisma/generated/` is committed but must match the schema; always run `npx prisma generate` after pulling schema changes.
- Lint exit code 1 from pre-existing oxfmt formatting warnings is expected and not a sign of breakage.
- The `#/*` import alias maps to `./app/` (configured in `vite.config.js`).
- **Alerting:** use `sendErrorAlert` / `sendAlertMessage` from `#/libs/alerting/index.server` for production errors and ops notifications; route handlers use `handleError` from `#/libs/error/index.server`. Default provider is Telegram (`ERROR_ALERT_PROVIDER=telegram`). Do not call `sendTelegramError` / `sendTelegramMessage` in new code. See [.cursor/rules/alerting.mdc](.cursor/rules/alerting.mdc).
- **Emails:** shop transactional templates in `app/emails/shop/`; auth templates in `app/emails/templates/`.
- **Locale:** storefront locale is cookie-driven, not in URL paths.
