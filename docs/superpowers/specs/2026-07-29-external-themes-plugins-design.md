# Design: External themes and plugins (remove bundled hardcoding)

**Date:** 2026-07-29  
**Status:** Approved  
**Repos:** bermooda app + bermooda CLI  
**Related:** [package.json plugin/theme manifest](./2026-07-25-package-json-plugin-theme-manifest-design.md), CLI `DESIGN.md`

## Goal

Stop shipping themes and plugins inside the bermooda app repo. First-party extensions live in their own GitHub repos under the `bermooda` org and publish to npm. `bermooda install` pulls the default theme, Meilisearch, and one chosen email provider. The app discovers whatever is on disk at startup — no hardcoded slug maps, legacy id maps, or bootstrap imports of specific extensions.

## Decisions

| Decision                           | Choice                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Repo layout                        | One GitHub repo per package (Approach 1)                                 |
| npm distribution                   | Public `@bermooda/*` packages (install needs no GitHub auth)             |
| Source repos                       | Private under `bermooda/` org is fine                                    |
| App discovery                      | Filesystem + `import.meta.glob` (plugins today; themes gain the same)    |
| CLI registration                   | Install onto disk + write `activeTheme` / `enabledPlugins` settings      |
| Generated registry file            | No                                                                       |
| Default email (interactive + `-y`) | Resend (`@bermooda/plugin-resend`)                                       |
| Always-on install extras           | `@bermooda/theme-default`, `@bermooda/meilisearch`                       |
| Removed (not extracted)            | `sample-analytics`, `fraud-guard`                                        |
| Legacy id maps                     | Remove entirely (`LEGACY_*`, `normalizeLegacyIds`) — no production users |
| Bundled slug maps                  | Remove (`BUNDLED_PLUGIN_SLUGS`, `BUNDLED_THEME_SLUGS`)                   |
| Contributor local setup            | Documented npm script that pulls the default three packages              |

## Package inventory

| GitHub repo                | npm package                 | `bermooda.slug` | Installs to                | Install behavior             |
| -------------------------- | --------------------------- | --------------- | -------------------------- | ---------------------------- |
| `bermooda/theme-default`   | `@bermooda/theme-default`   | `default`       | `app/themes/default/`      | Always install + activate    |
| `bermooda/meilisearch`     | `@bermooda/meilisearch`     | `meilisearch`   | `app/plugins/meilisearch/` | Always install + enable      |
| `bermooda/plugin-resend`   | `@bermooda/plugin-resend`   | `resend`        | `app/plugins/resend/`      | If chosen (default) + enable |
| `bermooda/plugin-sendgrid` | `@bermooda/plugin-sendgrid` | `sendgrid`      | `app/plugins/sendgrid/`    | If chosen + enable           |
| `bermooda/plugin-aws-ses`  | `@bermooda/plugin-aws-ses`  | `aws-ses`       | `app/plugins/aws-ses/`     | If chosen + enable           |

Each package keeps the existing extension contract (`package.json` with `bermooda.{title,slug,engine,…}`, theme `index.js` / plugin `index.server.js`). Drop `private: true` so packages can publish. Folder name on disk equals `bermooda.slug`.

Rename note: today’s in-app `app/plugins/ses` becomes slug/folder `aws-ses` and package `@bermooda/plugin-aws-ses`.

## App runtime

### Bootstrap

- Remove hard imports of `#/themes/default/*` and the dedicated `registerTheme(...)` call in `registerBuiltins()`.
- Keep `discoverPlugins()`.
- Add `discoverThemes()` mirroring plugins: `import.meta.glob('#/themes/*/index.js')` + sibling `package.json`, engine check, merge, `registerTheme`.
- Empty `app/themes/` / `app/plugins/` is valid at boot (nothing registered). Storefront/admin degrade gracefully until packages are installed.

### Slug / i18n resolution

- Delete `BUNDLED_PLUGIN_SLUGS`, `BUNDLED_THEME_SLUGS`, `LEGACY_PLUGIN_ID_MAP`, `LEGACY_THEME_ID_MAP`, and `normalizeLegacyIds`.
- Settings always store full package ids (e.g. `@bermooda/theme-default`).
- Resolve filesystem paths via `bermooda.slug` from each installed folder’s `package.json`, or from in-memory registries after discovery.
- Call sites that currently normalize legacy ids (admin/API theme & plugin routes, i18n, plugins/themes cores) use package ids and slug lookups only.

### Defaults / seed / tree

- `DEFAULT_ACTIVE_THEME` remains `@bermooda/theme-default`.
- Seed no longer enables sample-analytics (or any plugin by default in the bare app). After CLI install, `enabledPlugins` is `[@bermooda/meilisearch, @bermooda/plugin-<chosen-email>]`.
- App ships empty `app/themes/` and `app/plugins/` with `.gitkeep` (and a short README pointing at CLI / contributor script). Contents are gitignored except those keepers.

### Tests

- Tests that depended on in-repo plugins/themes use fixtures (e.g. under `app/test/fixtures/extensions/`) or mock discovery — not live `app/plugins/*` / `app/themes/*`.

## CLI: `bermooda install`

After app download, deps, env, and DB/bootstrap:

1. Interactive prompt: email provider — Resend / SendGrid / AWS SES (default Resend).
2. Flag: `--email-provider resend|sendgrid|aws-ses` (default `resend` with `-y`).
3. Install via existing npm-pack → copy path (`theme add` / `plugin add`):
   - always `@bermooda/theme-default` (activate)
   - always `@bermooda/meilisearch` (enable)
   - chosen email package (enable)
4. Persist settings through a shop-side helper (see below).
5. Fail clearly if a package is missing/unpublished or fails the engine semver check.

Order: extension install after shop `npm install`, and after DB is available so activate/enable can write settings.

### Settings writes (close today’s gap)

CLI `--enable` / `--activate` are currently hints only. This work makes them real:

- Add or extend a shop script (e.g. `scripts/cli-set-extensions.mjs`, or extend `scripts/cli-bootstrap.mjs`) that sets `activeTheme` and `enabledPlugins` via Prisma/settings.
- `bermooda install`, `plugin add --enable`, and `theme add --activate` invoke that path.
- Contributor bootstrap uses the same path.

### Contributor helper

In the app repo, e.g. `npm run extensions:install`:

- Installs `@bermooda/theme-default`, `@bermooda/meilisearch`, `@bermooda/plugin-resend`
- Activates/enables them
- Documented in README and AGENTS.md for local/Cloud Agent setups

## Extraction and publish

1. Create the five private GitHub repos under `bermooda/`.
2. Move code from `app/themes/default` and `app/plugins/{meilisearch,resend,sendgrid,ses}` into those repos; apply the `aws-ses` rename for SES.
3. Delete in-app copies plus `sample-analytics` and `fraud-guard`.
4. Per-repo CI: validate package shape + publish on tag/release.
5. First public npm publish is part of this work (blocked checklist if `@bermooda` npm org auth is unavailable).

## Error handling

| Case                             | Behavior                                                                   |
| -------------------------------- | -------------------------------------------------------------------------- |
| Unpublished / 404 npm package    | Hard fail with package name and hint to publish/version                    |
| Engine semver mismatch           | Existing hard-fail before copy                                             |
| Non-interactive missing provider | Default to `resend`                                                        |
| Empty themes/plugins at runtime  | Boot succeeds; features that need a theme/plugin no-op or show empty state |

## Out of scope

- Third-party marketplace UI
- Auto-updating installed extensions on `bermooda update` (beyond what CLI update already does for core)
- Extracting payment/shipping/tax providers from `app/core` (only themes/plugins under `app/themes` and `app/plugins`)

## Success criteria

- No `BUNDLED_*` or `LEGACY_*` extension id maps in the app
- No hardcoded theme/plugin imports in bootstrap
- Fresh `bermooda install -y` yields a shop with default theme active, Meilisearch + Resend enabled
- Interactive install can select SendGrid or AWS SES instead
- Cloned app + `npm run extensions:install` is enough for contributors to run the storefront
- Five packages exist on npm; source lives in five org repos
