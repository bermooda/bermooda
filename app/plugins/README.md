# app/plugins/

This directory is the install target for plugins. It is intentionally empty in the repository.

## Installing plugins

**Contributors / local dev:**

```bash
npm run extensions:install
```

This copies the default plugins (`meilisearch`, `resend`) from sibling checkouts (`../plugin-meilisearch`, `../plugin-resend`) or falls back to npm pack, then installs each plugin's own `package.json` dependencies into `app/plugins/<slug>/node_modules`.

**Production / CLI install:**

```bash
bermooda install        # interactive — prompts for email provider
bermooda install -y     # non-interactive — uses Resend as email provider
```

The CLI installs `@bermooda/plugin-meilisearch` and the chosen email provider here, runs `npm install` in each plugin folder for its dependencies, and enables them.

## Package contract

Each plugin lives in a subdirectory matching its `bermooda.slug` (e.g. `app/plugins/resend/`). The directory must contain:

- `package.json` with a `bermooda` block (`title`, `slug`, `engine`)
- `index.server.js` exporting `definePlugin(...)` as `pluginManifest` or `default`
- Optional: `admin/routes/`, `storefront/routes/`, `blocks/`, `i18n/<locale>.json`

## Dependencies

Plugins may declare their own npm `dependencies` / `optionalDependencies` in `package.json`. Shared runtime libraries used by the shop (`react`, `react-dom`, `react-router`, etc.) should be `peerDependencies` so they resolve from the shop root.

Before `npm run build`, `prebuild` runs `npm run extensions:install-deps` so nested `node_modules` exist. Vite lists those runtime dependency names in `ssr.noExternal` so they are bundled into `build/server` (nested `node_modules` are build inputs, not required at runtime in the production image).
