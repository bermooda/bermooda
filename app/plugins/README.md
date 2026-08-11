# app/plugins/

This directory is the install target for plugins. It is intentionally empty in the repository.

## Installing plugins

**Contributors / local dev:**

`npm run setup` / `npm run extensions:install` install the **default theme only** — no plugins.

To add a plugin:

```bash
bermooda plugin add @bermooda/plugin-meilisearch --enable
# or from a sibling checkout:
bermooda plugin add --path ../plugin-meilisearch --enable
```

**Production / CLI install:**

```bash
bermooda install
```

The CLI installs `@bermooda/plugin-meilisearch` by default. Add email or other plugins afterward with `bermooda plugin add`.

## Package contract

Each plugin lives in a subdirectory matching its `bermooda.slug` (e.g. `app/plugins/meilisearch/`). The directory must contain:

- `package.json` with a `bermooda` block (`title`, `slug`, `engine`)
- `index.server.js` exporting `definePlugin(...)` as `pluginManifest` or `default`
- Optional: `admin/routes/`, `storefront/routes/`, `blocks/`, `i18n/<locale>.json`

## Dependencies

Plugins may declare their own npm `dependencies` / `optionalDependencies` in `package.json`. Shared runtime libraries used by the shop (`react`, `react-dom`, `react-router`, etc.) should be `peerDependencies` so they resolve from the shop root.

Before `npm run build`, `prebuild` runs `npm run extensions:install-deps` so nested `node_modules` exist. Vite lists those runtime dependency names in `ssr.noExternal` so they are bundled into `build/server` (nested `node_modules` are build inputs, not required at runtime in the production image).
