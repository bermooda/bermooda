# bermooda

**Own your commerce stack.** bermooda is an open-source ecommerce platform that runs as a single deployable app: themed storefront, merchant admin, and REST API—together.

Clone it, scaffold a shop in minutes, and ship real catalog, cart, checkout, orders, and staff tools without bolting together a half-dozen SaaS products. Domain logic lives in one place (`app/core/*`), so you can read, change, and extend the engine like any other Node app.

If you want a full shop you can fork, understand, and grow—welcome.

## Why engineers try it

- **One service, three surfaces** — storefront, admin, and public/admin REST APIs in a single React Router app
- **Real commerce primitives** — catalog, cart, checkout, payments, shipping, customers, discounts, inventory, and more under `app/core/*`
- **Themes & plugins** — swap storefront UI under `app/themes/*`; extend behavior with hook-based plugins under `app/plugins/*`
- **Local-first** — SQLite for development, PostgreSQL when you need it; no Docker or external DB required to start
- **CLI-first setup** — `bermooda install` scaffolds deps, env, database, admin user, and store name for you

## Stack

| Layer         | Choice                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Runtime       | Node.js ≥ 22.22                                                                          |
| App framework | [React Router 8](https://reactrouter.com/) (SSR, loaders, actions)                       |
| UI            | React 19, Tailwind CSS 4                                                                 |
| Build         | Vite 8                                                                                   |
| Data          | Prisma 7 · SQLite (local) · PostgreSQL (production-ready)                                |
| Auth          | [better-auth](https://www.better-auth.com/) (separate admin/staff and customer sessions) |
| Payments      | Stripe                                                                                   |
| Email         | Resend (+ React Email templates)                                                         |
| Deploy        | Fly.io + LiteFS (SQLite replication) or plain Node / Docker                              |
| Quality       | Vitest, oxlint, oxfmt                                                                    |

## Quick start (recommended)

Scaffold a shop with the global CLI:

```bash
npm i -g bermooda-cli@latest

bermooda install --local --dir ./my-shop -y \
  --admin-email admin@example.com \
  --admin-password 'TestPass123!' \
  --store-name 'Demo Shop'

cd my-shop
bermooda dev
```

Open [http://localhost:3000](http://localhost:3000). Admin is typically at `/admin`.

### Install the CLI

```bash
npm i -g bermooda-cli@latest
```

Requires **Node.js ≥ 22.22**. After install, the `bermooda` binary is available globally.

### CLI commands (overview)

| Command                                | What it does                                                         |
| -------------------------------------- | -------------------------------------------------------------------- |
| `bermooda install [--local\|--server]` | Download app, install deps, configure env & DB, create admin + store |
| `bermooda dev`                         | Start the dev server (no 1Password wrapper)                          |
| `bermooda start`                       | Run production server (builds if needed)                             |
| `bermooda update`                      | Update the shop to the latest app version                            |
| `bermooda plugin …`                    | Add / update / remove / list plugins                                 |
| `bermooda theme …`                     | Add / update / remove / list themes                                  |
| `bermooda version`                     | Show CLI and shop versions                                           |
| `bermooda upgrade`                     | Upgrade the CLI itself                                               |
| `bermooda help [command]`              | Built-in help                                                        |

**Full command reference, flags, and design notes:** see the [bermooda-cli README](https://github.com/bermooda/bermooda-cli#readme) and [DESIGN.md](https://github.com/bermooda/bermooda-cli/blob/main/DESIGN.md). In-repo product checklist: [docs/cli-specs.md](docs/cli-specs.md).

Offline install from a local checkout of this repo:

```bash
bermooda install --local --source /path/to/bermooda --dir ./my-shop -y \
  --admin-email admin@example.com \
  --admin-password 'TestPass123!' \
  --store-name 'Demo Shop'
```

## Working from this repository

Useful if you are contributing to the platform itself:

```bash
npm install
cp .env.example .env   # placeholders are fine for basic local work
npm run setup          # prisma generate + migrate deploy
npm run seed           # optional demo catalog + admin
```

### Development

```bash
# Default local script (wraps env with 1Password CLI if you use it):
npm run dev

# Plain env file (no 1Password):
npx react-router dev --port 3000 --host
# or, with the CLI installed:
bermooda dev
```

App: [http://localhost:3000](http://localhost:3000)

### Common scripts

| Task             | Command                                   |
| ---------------- | ----------------------------------------- |
| Setup DB         | `npm run setup`                           |
| Seed demo data   | `npm run seed`                            |
| Tests            | `npm run test`                            |
| Lint             | `npm run lint`                            |
| Format           | `npm run fmt`                             |
| Production build | `npm run build`                           |
| New migration    | `npm run prisma:migrate -- --name <name>` |

Reset local SQLite: delete `prisma/dev.db` and re-run `npm run setup`.

## Architecture (at a glance)

```
app/
  core/       # Domain workflows (catalog, cart, orders, payments, …)
  libs/       # Infrastructure (auth, Prisma, queue, alerting, SDKs)
  routes/     # Storefront, admin, API, webhooks, auth
  themes/     # Storefront themes (active theme renders the shop)
  plugins/    # Hook-based extensions (blocks, admin pages, providers)
  components/ # Shared admin / auth / UI primitives
```

- **Routes** stay thin: loaders/actions call `app/core/*`.
- **Themes** receive data via props/loaders; they do not import server core modules.
- **Plugins** register hooks, providers, and optional admin/storefront UI.

Deeper reading:

- [docs/themes.md](docs/themes.md) — storefront themes
- [docs/plugins.md](docs/plugins.md) — plugin system
- [docs/api.md](docs/api.md) — public & admin REST API
- [docs/auth.md](docs/auth.md) — dual admin / customer auth
- [docs/testing.md](docs/testing.md) — Vitest setup

## Configuration

Copy [`.env.example`](.env.example) to `.env`. Placeholder values are enough to boot the app; wire real keys when you need payments, email, OAuth, or object storage.

Notable variables:

| Variable                                    | Purpose                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                              | SQLite (`file:./prisma/dev.db`) or PostgreSQL connection string |
| `BETTER_AUTH_SECRET`                        | Auth secret (use a strong value in production)                  |
| `STRIPE_*`                                  | Payments                                                        |
| `RESEND_API_KEY`                            | Transactional email                                             |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth                                           |
| `STORAGE_*`                                 | S3-compatible object storage (e.g. Tigris on Fly.io)            |

### Google OAuth (optional)

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth client credentials (Web application)
3. Authorized redirect URIs:
   - Development: `http://localhost:3000/auth/callback/google`
   - Production: `https://your-domain/auth/callback/google`
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

## Production

### Build

```bash
npm run build
npm start   # or: bermooda start
```

Build output:

```
build/
  client/   # Static assets
  server/   # Server bundle
```

### Docker

```bash
docker build -t bermooda .
docker run -p 3000:3000 bermooda

# With env file and SQLite path (example):
docker run -p 8081:8081 -p 8080:8080 --env-file .env \
  -e DATABASE_URL=file:/app/sqlite.db bermooda npm run start
```

### Fly.io

bermooda ships with `fly.toml`, LiteFS config, and a production-oriented Dockerfile. High-level flow:

1. [Install flyctl](https://fly.io/docs/getting-started/installing-flyctl/) and `fly auth login`
2. Create apps (production + optional staging); match names in `fly.toml`
3. Import secrets: `fly secrets import < .env` (plus a strong `BETTER_AUTH_SECRET`)
4. Create a data volume, attach Consul for LiteFS leases, and create Tigris storage if you need uploads
5. Deploy via Fly or your preferred CI

See [docs/storage.md](docs/storage.md) and [docs/postgres.md](docs/postgres.md) when you move beyond local SQLite.

## Contributing

Issues and PRs that improve the commerce core, themes, plugins, docs, or DX are welcome. Prefer small, focused changes that match patterns in nearby files. Project conventions live in [AGENTS.md](AGENTS.md) / [Claude.md](Claude.md).

```bash
npm run test
npm run lint
```
