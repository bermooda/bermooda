# bermooda — Claude Code rules

Project-wide conventions. Operational/setup notes live in [AGENTS.md](AGENTS.md).

bermooda is an open-source ecommerce platform: one React Router app with a themed storefront, merchant admin, and REST API. Ecommerce domain logic lives in `app/core/*`; do not add new shop workflows under `app/services`.

This ruleset intentionally keeps only non-obvious, repository-specific requirements. Favor existing patterns in nearby files over introducing new abstractions.

## Core

- Make the smallest change that fully solves the task.
- In `app/`, write JavaScript/JSX (not TypeScript) unless explicitly requested.
- Add new persistent rules only when they fix repeated agent mistakes.

## Imports and logging

- For imports inside `app/`, use the `#/*` alias instead of deep relative paths (`#/*` maps to `./app/`, configured in [vite.config.js](vite.config.js)).
- **Exception — themes and plugins:** inside `app/themes/<slug>/` and `app/plugins/<slug>/`, import sibling files in the same theme/plugin with **relative** paths. Keep `#/…` only for core app modules (`#/core`, `#/components`, `#/libs`, `#/utils`, etc.). Outside themes/plugins, continue to load them via `#/themes/…` and `#/plugins/…`.
- Do not include file extensions in imports (except `.json` when required).
- On the server, use `#/utils/logger.server` for logging; avoid `console.log`.

## Validation

- Before finishing, run at least one relevant validation step for touched code (targeted test, lint, or build command).

## File naming (`app/**/*.{js,jsx}`)

- Use lowercase, hyphenated file and directory names.
- Use `PascalCase` for exported React component function names.
- Use `.jsx` for files containing JSX; `.js` for non-JSX modules.
- Add `.server` before the extension for server-only modules (`*.server.js`, `*.server.jsx`).
- Custom hooks in `app/hooks` use `use-*.jsx` naming.
- Layout route modules use `_layout.jsx`.
- Use `index.jsx` / `index.js` only for directory entry modules.

## Components (`app/components/**`, `app/themes/**`)

Keep component rules short and practical. Favor existing patterns in nearby files.

**Placement**

- Reusable primitives in `app/components/ui/`.
- Admin back-office UI in `app/components/admin/`.
- Shared auth chrome in `app/components/auth/`.
- Marketing/landing pages in `app/components/landing/`.
- **Storefront page UI** in `app/themes/<name>/components/` (not `app/components/`).
- Keep route-level data loading/mutations in routes and `app/core`, not in shared UI primitives.

**Boundaries**

- `ui` components are presentation-focused and reusable.
- Feature components can compose UI components and local hooks.
- Move business workflows to `app/core` when logic grows beyond view orchestration.
- Theme components receive data via props/loaders; do not import `app/core/*.server` from theme code.

**Naming**

- Component file names are lowercase and hyphenated.
- Component function names are PascalCase.

## Libs vs core (`app/libs/**`, `app/core/**`)

**`app/libs`** — infrastructure and integrations (auth setup, db clients, queue, third-party SDK wrappers, alerting). Keep modules reusable and low-level. Do not put domain workflows here.

**Alerting** — production errors and ops notifications use the provider registry in `#/libs/alerting/index.server` (`sendErrorAlert`, `sendAlertMessage`). Default provider is Telegram. Route handlers use `handleError` from `#/libs/error/index.server`. See [.cursor/rules/alerting.mdc](.cursor/rules/alerting.mdc).

**`app/core`** — domain/business workflows that orchestrate libs and persistence (catalog, cart, orders, payments, shipping, customers, etc.). Core modules may depend on libs and other core modules. **Do not add new ecommerce code under `app/services`.**

**Dependency boundary**

- `core -> libs` is allowed.
- `libs -> core` is not allowed.

**File pattern**

- Prefer `*.server.js` for server-only modules in both directories.

See also [.cursor/rules/ecommerce-architecture.mdc](.cursor/rules/ecommerce-architecture.mdc) for themes, plugins, auth, and route surfaces.

## Utils and hooks (`app/utils/**`, `app/hooks/**`)

**`app/utils`**

- Reusable helper functions.
- Keep utilities small and mostly side-effect free.
- Use `*.server.js` for server-only utilities.
- Do not place business workflows here (use `app/core`).

**`app/hooks`**

- Reusable React state/effect logic.
- Hook files named `use-*.jsx`; hook functions start with `use`.
- If logic does not need React, move it to `app/utils`.

**Shared boundaries**

- Keep data-layer workflows in routes and `app/core`, not in generic hooks/utils.

## React Router framework

Use React Router framework mode for routing and data APIs in this repo.

- Do not use Remix imports.
- Define URL mappings in [app/routes.js](app/routes.js), not via route-file naming conventions.
- When adding/removing a route module, update `app/routes.js` in the same change.
- Prefer React Router loaders/actions for server data work in route modules.

Reference: https://reactrouter.com/home

## Routes (`app/routes/**`)

**Surfaces** — `storefront/` (shop), `admin/` (back office), `api/v1/` (public API), `api/admin/v1/` (admin API), `webhooks/`, `auth/`. Plugin dispatchers: `admin/plugins/$pluginId`, `storefront/apps/$pluginId`.

**File layout** — do **not** use React Router filename dot routing (avoid `account.orders.jsx`). Prefer nested directories.

| Rule                                    | Example                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Nested paths are directories            | `storefront/account/orders.jsx`, not `storefront/account.orders.jsx`                                                                           |
| Only layout files use a leading `_`     | `storefront/_layout.jsx`, `storefront/account/_layout.jsx`                                                                                     |
| Index routes are plain `index.jsx`      | `storefront/account/index.jsx` (never `_index.jsx`)                                                                                            |
| Dynamic segments stay in the filename   | `webhooks/$provider.jsx`                                                                                                                       |
| No `.server` in route or test filenames | `webhooks/$provider.jsx` and `webhooks/$provider.test.jsx` — not `$provider.server.jsx`. Put server-only helpers in `#/libs/*.server` instead. |

Configure explicit URLs in [app/routes.js](app/routes.js) to match this tree.

**Conventions**

- Configure route paths in [app/routes.js](app/routes.js).
- Route modules default-export a route component function (typically `PascalCaseRoute` naming).
- Export `meta` when the page should set title/metadata.

**Data and mutations**

- Read data in `loader`.
- Handle mutations in `action`, typically from `<Form>` or `fetcher` submissions.
- Call `app/core/*` for domain logic; keep routes thin.

**Auth and errors**

Dual auth — admin/staff and customers are separate better-auth instances ([docs/auth.md](docs/auth.md)).

- **Admin routes** — `adminAuthMiddleware` from `#/libs/auth/admin/index.server`, or `authenticate(request)` in layout loaders.
- **Customer account routes** — `customerAuthMiddleware` from `#/libs/auth/customer/index.server`, or `getCustomerSession(request)` in layout loaders.
- In loader/action `catch` blocks, return `handleError` from `#/libs/error/index.server` (logs + production alert via `#/libs/alerting/index.server`).
- For background jobs or direct alerts, use `sendErrorAlert` / `sendAlertMessage` from `#/libs/alerting/index.server`.

**Boundaries**

- Keep route orchestration in route modules.
- Move reusable UI to `app/components` (admin) or `app/themes/<name>/components/` (storefront).
- Move domain workflows to `app/core`.

## Themes and plugins

- **Themes** — `app/themes/<name>/` (manifest, components, i18n). See [docs/themes.md](docs/themes.md).
- **Plugins** — `app/plugins/<id>/` (manifest, hooks, blocks, admin routes). See [docs/plugins.md](docs/plugins.md).
- Inside themes/plugins, use relative imports for sibling modules; keep `#/…` for core app modules.
- Storefront locale is cookie-driven, not in URL paths (`app/core/i18n/`).

## Emails

- Shop transactional: `app/emails/shop/`.
- Auth: `app/emails/templates/`.
- Queue: `#/emails/job.server`.

## Prisma schema changes (`prisma/schema.prisma`)

When `prisma/schema.prisma` changes, complete these steps before finishing:

1. Create a migration: `npm run prisma:migrate -- --name <descriptive_snake_case_name>`. Confirm generated SQL in `prisma/migrations/` matches the intent.
2. Always regenerate with: `DATABASE_URL="file:./prisma/dev.db" npm run prisma:generate`.
3. Always use `npm run prisma:generate` — do not call `npx prisma generate` or `prisma generate` directly. The generated client under `app/generated/prisma/` is gitignored; do not commit it.

Do not ship schema changes without a migration.
