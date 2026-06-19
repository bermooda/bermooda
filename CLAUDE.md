# bermooda — Claude Code rules

Project-wide conventions. Operational/setup notes live in [AGENTS.md](AGENTS.md).

This ruleset intentionally keeps only non-obvious, repository-specific requirements. Favor existing patterns in nearby files over introducing new abstractions.

## Core

- Make the smallest change that fully solves the task.
- In `app/`, write JavaScript/JSX (not TypeScript) unless explicitly requested.
- Add new persistent rules only when they fix repeated agent mistakes.

## Imports and logging

- For imports inside `app/`, use the `#/*` alias instead of deep relative paths (`#/*` maps to `./app/`, configured in [vite.config.js](vite.config.js)).
- Do not include file extensions in imports.
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

## Components (`app/components/**`)

Keep component rules short and practical. Favor existing patterns in `app/components`.

**Placement**

- Reusable primitives in `app/components/ui/`.
- Feature-specific UI in its feature folder (e.g. `auth/`, `dashboard/`, `landing/`, `support/`).
- Keep route-level data loading/mutations in routes and services, not in shared UI primitives.

**Boundaries**

- `ui` components are presentation-focused and reusable.
- Feature components can compose UI components and local hooks.
- Move business workflows to `app/services` (or `app/core`) when logic grows beyond view orchestration.

**Naming**

- Component file names are lowercase and hyphenated.
- Component function names are PascalCase.

## Libs vs core (`app/libs/**`, `app/core/**`)

**`app/libs`** — infrastructure and integrations (auth setup, db clients, queue, third-party SDK wrappers). Keep modules reusable and low-level. Do not put domain workflows here.

**`app/core`** — domain/business workflows that orchestrate libs and persistence (catalog, cart, orders, payments, shipping, customers, etc.). Core modules may depend on libs and other core modules.

**Dependency boundary**

- `core -> libs` is allowed.
- `libs -> core` is not allowed.

**File pattern**

- Prefer `*.server.js` for server-only modules in both directories.

## Utils and hooks (`app/utils/**`, `app/hooks/**`)

**`app/utils`**

- Reusable helper functions.
- Keep utilities small and mostly side-effect free.
- Use `*.server.js` for server-only utilities.
- Do not place business workflows here (use `app/services` / `app/core`).

**`app/hooks`**

- Reusable React state/effect logic.
- Hook files named `use-*.jsx`; hook functions start with `use`.
- If logic does not need React, move it to `app/utils`.

**Shared boundaries**

- Keep data-layer workflows in routes/services, not in generic hooks/utils.

## React Router framework

Use React Router framework mode for routing and data APIs in this repo.

- Do not use Remix imports.
- Define URL mappings in [app/routes.js](app/routes.js), not via route-file naming conventions.
- When adding/removing a route module, update `app/routes.js` in the same change.
- Prefer React Router loaders/actions for server data work in route modules.

Reference: https://reactrouter.com/home

## Routes (`app/routes/**`)

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

**Auth and errors**

- For authenticated routes, export `middleware = [authMiddleware]` from `#/libs/auth/admin.server`.
- In loader/action `catch` blocks, return `handleError` from `#/libs/error.server`.

**Boundaries**

- Keep route orchestration in route modules.
- Move reusable UI to `app/components` and domain workflows to `app/core`.

## Prisma schema changes (`prisma/schema.prisma`)

When `prisma/schema.prisma` changes, complete these steps before finishing:

1. Create a migration: `npm run prisma:migrate -- --name <descriptive_snake_case_name>`. Confirm generated SQL in `prisma/migrations/` matches the intent.
2. Regenerate client: `npx prisma generate`.
3. Verify that `prisma/generated/` reflects the updated schema.

Do not ship schema changes without a migration.
