## Releases and commit messages

Publishing is automated by
[release-please](https://github.com/googleapis/release-please) on every push to
`master` (see `.github/workflows/publish.yml`, `release-please-config.json`, and
`.release-please-manifest.json`). **Commit subjects and PR titles must use
[Conventional Commits](https://www.conventionalcommits.org/)** so the correct
semver bump (or no release) is chosen.

| Type                                                        | Release |
| ----------------------------------------------------------- | ------- |
| `feat`                                                      | minor   |
| `fix`, `perf`, `revert`                                     | patch   |
| `feat!` / `fix!` / `BREAKING CHANGE:`                       | major   |
| `docs`, `style`, `chore`, `refactor`, `test`, `build`, `ci` | none    |

Flow: releasable commits on `master` open/update a Release Please PR (version
bump + `CHANGELOG.md`). Merging that PR creates the GitHub release/tag and
publishes to npm via OIDC trusted publishing in the same workflow.

Do **not** bump `package.json` `"version"`, run `npm version`, or push `v*` tags
by hand — release-please owns releases. Squash-merge PR titles must also be
Conventional Commits. See
[`.cursor/rules/conventional-commits.mdc`](.cursor/rules/conventional-commits.mdc).

## Cursor Cloud specific instructions

### Overview

bermooda is an open-source ecommerce platform built with React Router 7 (SSR), Prisma 7 with SQLite, and Vite 8. It is a single-service monolith — no Docker, no external database server needed for development. One app serves the themed storefront, merchant admin, and REST API.

### Cloud Agent environment

The checked-in [`.cursor/environment.json`](.cursor/environment.json) configures the Cloud Agent install step. On each agent startup, Cursor runs [`.cursor/cloud-agent-install.sh`](.cursor/cloud-agent-install.sh), which:

1. Runs `npm install --legacy-peer-deps`.
2. Runs `npm run setup` (creates `.env` / `bermooda.config.js` when missing, Prisma generate + migrate deploy, default theme install).

The install script is idempotent and safe to run repeatedly. To reset the local database, delete `prisma/dev.db` and re-run `npm run setup`.

**Themes are not bundled in the repo.** `npm run setup` creates `.env` from `.env.example` when missing, ensures config, runs Prisma generate + migrate, then installs the default theme (`@bermooda/theme-default`) from a sibling checkout (`../theme-default`) or npm pack into `app/themes/default/`, installs that theme's npm dependencies, and sets `activeTheme` when `DATABASE_URL` is available. It does not install plugins. Re-run `npm run extensions:install` after pulling new theme code. To only (re)install nested deps for extensions already on disk: `npm run extensions:install-deps`.

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

Port comes from `PORT` (default `3000`) via Vite `server.port` / `#/libs/config` — set `PORT=4000` to change it. `strictPort` is enabled so a busy port fails instead of silently binding another one.

A `.env` file must exist in the repo root (see `.env.example`). `npm run setup` creates it from the example when missing. Placeholder values are fine for basic local development — the app starts and serves pages without real API keys for Stripe, etc. Transactional email defaults to built-in Nodemailer (SMTP via `email.smtp` in `bermooda.config.js`; Nodemailer defaults when omitted).

`bermooda.config.js` is gitignored and created by `npm run setup` (copies `bermooda.config.example.js`) or by `bermooda install`. Production requires `baseUrl` in that file.

### Key commands

| Task                   | Command                                            |
| ---------------------- | -------------------------------------------------- |
| Install deps           | `npm install`                                      |
| Full local setup       | `npm run setup` (`.env` + config + Prisma + theme) |
| Install default theme  | `npm run extensions:install`                       |
| Install extension deps | `npm run extensions:install-deps`                  |
| Dev server             | `npx react-router dev --host`                      |
| Lint                   | `npm run lint` (oxlint + oxfmt --check)            |
| Format                 | `npm run fmt`                                      |
| Build                  | `npm run build`                                    |
| Tests                  | `npm run test`                                     |
| New migration          | `npm run prisma:migrate -- --name <name>`          |
| Set extension settings | `npm run cli:set-extensions`                       |

### Non-obvious notes

- **Vitest** (`vitest.config.js`) runs two projects: `unit` (happy-dom) and `server` (Node). Shared setup is `app/test-setup.js`. Use `npm run test`, `npm run test:watch`, or `npm run test:coverage`.
- The SQLite database file is created at `prisma/dev.db` on first `prisma migrate deploy`. Delete it and re-run `npm run setup` to reset.
- The Prisma client under `app/generated/prisma/` is gitignored; create it with `npm run prisma:generate` (also run by `npm run setup`). Do not call `npx prisma generate` or `prisma generate` directly.
- Lint exit code 1 from pre-existing oxfmt formatting warnings is expected and not a sign of breakage.
- The `#/*` import alias maps to `./app/` (configured in `vite.config.js`).
- Inside `app/themes/<slug>/` and `app/plugins/<slug>/`, use relative imports for sibling modules; keep `#/…` for core app modules. Oxlint enforces this via `no-restricted-imports` overrides.
- **Alerting:** use `sendErrorAlert` / `sendAlertMessage` from `#/libs/alerting/index.server` for production errors and ops notifications; route handlers use `handleError` from `#/libs/error/index.server`. Default provider is Telegram (`ERROR_ALERT_PROVIDER=telegram`). Do not call `sendTelegramError` / `sendTelegramMessage` in new code. See [.cursor/rules/alerting.mdc](.cursor/rules/alerting.mdc).
- **Emails:** shop transactional templates in `app/emails/shop/`; auth templates in `app/emails/templates/`. Optional email transports are external plugins (`@bermooda/plugin-resend`, `@bermooda/plugin-sendgrid`, `@bermooda/plugin-aws-ses`) activated under Admin → Plugins — see [.cursor/rules/email-providers.mdc](.cursor/rules/email-providers.mdc).
- **Extensions:** `app/themes/` and `app/plugins/` are empty in the repo and gitignored. `npm run setup` (or `npm run extensions:install`) installs the default theme from a sibling checkout or npm — not plugins. `npm run build` runs `prebuild` → `extensions:install-deps` so nested deps exist for Vite; extension runtime deps are listed in `ssr.noExternal` and bundled into the server build.
- **Locale:** storefront locale is cookie-driven, not in URL paths.
