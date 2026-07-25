# Design: Replace plugin/theme `manifest.js` with `package.json`

**Date:** 2026-07-25  
**Status:** Approved

## Goal

Remove `manifest.js` from plugins and themes. Identity and display metadata live in each package’s `package.json`, so plugins and themes can later ship as standalone repos / npm packages. Runtime code (hooks, providers, blocks, theme components) stays in JS entry modules and is merged with package metadata automatically at discovery time.

## Decisions

| Decision | Choice |
| -------- | ------ |
| Identity `id` | Full `package.json` `name`, including scope (e.g. `@bermooda/sample-analytics`) |
| Display name | `bermooda.title` (required) — replaces former manifest `name` |
| Version / description | Top-level `version` and `description` |
| URL key | `bermooda.slug` (required) — not the package name |
| Slug format | Lowercase hyphenated: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| Theme component registration | Thin `defineTheme({ components })` in JS; metadata auto-merged from `package.json` |
| Theme entry filename | `index.js` (client-safe; storefront component registry) |
| Plugin entry filename | `index.server.js` (unchanged) |
| Passing metadata into `definePlugin` / `defineTheme` | Not required; auto-loaded from sibling `package.json` |
| `adminRoutes` / `storefrontRoutes` in package metadata | Dropped; route presence remains glob-driven |

## Package.json contract

Every plugin and theme root includes a `package.json`:

```json
{
  "name": "@bermooda/sample-analytics",
  "version": "1.0.0",
  "description": "Captures order.created events and surfaces them in admin and storefront pages.",
  "bermooda": {
    "title": "Sample Analytics",
    "slug": "sample-analytics"
  }
}
```

### Field mapping

| Runtime field | Source | Required |
| ------------- | ------ | -------- |
| `id` | `name` | yes |
| `version` | `version` | yes |
| `description` | `description` | no |
| `title` | `bermooda.title` | yes |
| `slug` | `bermooda.slug` | yes |
| `settings` | `bermooda.settings` | no (JSON schema for admin forms) |

### Slug rules

- Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase letters, digits, hyphens; no leading/trailing hyphen).
- Must be unique among registered plugins (plugin slug space) and among registered themes (theme slug space).
- Used for URL segments only. Document clearly that **`id` ≠ URL path**.

### First-party examples

| Package | `name` (id) | `bermooda.slug` | Folder |
| ------- | ------------- | --------------- | ------ |
| Sample Analytics | `@bermooda/sample-analytics` | `sample-analytics` | `app/plugins/sample-analytics/` |
| Fraud Guard | `@bermooda/fraud-guard` | `fraud-guard` | `app/plugins/fraud-guard/` |
| Meilisearch | `@bermooda/meilisearch` | `meilisearch` | `app/plugins/meilisearch/` |
| Default theme | `@bermooda/theme-default` | `default` | `app/themes/default/` |

Folder name for bundled first-party packages equals `slug` so filesystem globs and i18n paths stay simple.

## Plugins

### Author entry (`index.server.js`)

Authors only declare runtime behavior:

```js
export default definePlugin({
  hooks: defineHooks({
    'order.created': handleOrderCreated,
  }),
  blocks: {
    'product.afterDescription': ProductAfterDescriptionBlock,
  },
});
```

Do **not** pass `id`, `title`, `version`, `description`, or `slug`. Those come from `package.json`.

### Discovery and merge

1. Eager-glob `#/plugins/*/index.server.js`.
2. For each module, read the sibling `package.json` (same directory).
3. Parse and validate package metadata (including slug format and uniqueness).
4. Take `mod.default` / `mod.pluginManifest` as the runtime config from `definePlugin`.
5. Merge → registered manifest: `{ id, title, version, description, slug, ...runtime }`.
6. Register keyed by `id`; maintain a slug → id index for URL dispatch.

`definePlugin` validates runtime-only concerns (e.g. `providers` via `defineProviders`). Identity validation happens at package-merge / register time.

### Routes and URLs

- Admin: `/admin/plugins/:pluginId/*` where `pluginId` param is the **slug**.
- Storefront: `/apps/:pluginId/*` where `pluginId` param is the **slug**.
- Route registries built from globs stay keyed by **slug** (folder segment in `#/plugins/<slug>/...`).
- Dispatchers resolve slug → registered plugin (via slug index), then check enabled state by **id**.

### Persistence

- `enabledPlugins` stores full package **ids** (e.g. `@bermooda/sample-analytics`).
- PluginData and settings keys continue to namespace by **id**.
- Migration: map legacy short ids (`sample-analytics`) to scoped names for first-party plugins on read or via one-time seed/settings update.

### Removed from package metadata

`adminRoutes` and `storefrontRoutes` are not declared in `package.json`. Presence of `admin/routes` / `storefront/routes` modules (existing globs) is sufficient. Dispatcher “has routes?” checks use the route registry, not package fields.

## Themes

### Author entry (`index.js`)

Client-safe module so `#/core/themes/storefront-components` can import components:

```js
import Layout from './components/layout';
import HomePage from './components/home-page';
// ...

export default defineTheme({
  components: {
    Layout,
    HomePage,
    // required + optional components
  },
});
```

Metadata is **not** passed here; it is merged from `package.json` the same way as plugins.

Optional theme settings schema may live under `bermooda.settings` in `package.json` (JSON), or remain attachable on the runtime object if already supported in code — prefer `bermooda.settings` for declarative settings.

### Discovery and registries

- Server: load theme `index.js` + sibling `package.json`, merge, `registerTheme` into the server registry (keyed by `id`, slug index for paths).
- Client: import/glob theme `index.js` into the storefront component registry. Rendering needs `components`; identity fields may be present after merge if the client loader also reads `package.json`, or the client registry can store `{ id, slug, components }` from a small shared helper used at register time.

Practical approach for bundled themes:

1. Shared helper `loadThemePackage(dirUrl)` / merge used by bootstrap.
2. `storefront-components` imports `#/themes/default/index` (components export) and registers under theme `id` from the merged package (static import of `package.json` is fine in Vite).

### Active theme and filesystem

- `activeTheme` setting stores the full package **id**.
- i18n and on-disk theme assets resolve via **slug** → `app/themes/<slug>/i18n/...`.
- Fallback when unset: first-party default theme id `@bermooda/theme-default` (slug `default`).

## Shared platform helpers

Introduce small shared utilities (location TBD under `app/core/plugins` / `app/core/themes` or a tiny shared module) to:

1. Read/parse `package.json` next to an entry module.
2. Map package → `{ id, title, version, description, slug, settings? }`.
3. Validate required fields and slug pattern.
4. Enforce slug uniqueness within the relevant registry.

Rename display field throughout UI/docs from manifest `name` → `title` where it means human-readable label. Keep npm `name` only as the source of `id`.

## Documentation

Update:

- [docs/plugins.md](../../plugins.md) — package.json contract, `id` vs `slug`, auto-loaded metadata, sample walkthrough, folder layout without `manifest.js`.
- [docs/themes.md](../../themes.md) — same for themes; `index.js` + `defineTheme({ components })`; note that components cannot live in JSON.
- Architecture notes / cursor rules that still say `manifest.js`.

Explicit doc callouts:

- Third-party packages use the full scoped `name` as `id` so owners are identifiable.
- URLs always use `bermooda.slug`; slug must be URL-friendly (lowercase + hyphens).

## Migration checklist (implementation)

1. Add `package.json` to each existing plugin and the default theme; delete `manifest.js`.
2. Change `definePlugin` / `defineTheme` + discovery/register to auto-merge package metadata.
3. Switch route params and admin links to **slug**; persist enablement / `activeTheme` as **id**.
4. Update i18n path resolution to use theme/plugin **slug**.
5. Update admin UI to show `title`, and show `id` where ownership clarity helps.
6. Update tests, seed defaults, and docs.
7. Remove unused `#/core/plugins/manifest.js` / theme constant duplication only where superseded (keep `REQUIRED_COMPONENTS` etc.).

## Non-goals (this change)

- Installing arbitrary npm theme/plugin packages from the registry at runtime.
- Changing the hook/provider/block APIs.
- Moving plugins/themes out of `app/plugins` and `app/themes` in this repo (layout stays; `package.json` prepares for external packages later).

## Testing

- Unit tests for package → metadata mapping and slug validation.
- Plugin discovery/register tests with `package.json` fixtures.
- Theme `defineTheme` / register tests without metadata in the JS entry.
- Route dispatcher tests using slugs in params and ids in enablement checks.
- Admin list UI shows `title`; activate/enable persistence uses full ids.
