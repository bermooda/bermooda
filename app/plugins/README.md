# app/plugins/

This directory is the install target for plugins. It is intentionally empty in the repository.

## Installing plugins

**Contributors / local dev:**

```bash
npm run extensions:install
```

This copies the default plugins (`meilisearch`, `resend`) from sibling checkouts (`../meilisearch`, `../plugin-resend`) or falls back to npm pack.

**Production / CLI install:**

```bash
bermooda install        # interactive — prompts for email provider
bermooda install -y     # non-interactive — uses Resend as email provider
```

The CLI installs `@bermooda/meilisearch` and the chosen email provider here and enables them.

## Package contract

Each plugin lives in a subdirectory matching its `bermooda.slug` (e.g. `app/plugins/resend/`). The directory must contain:

- `package.json` with a `bermooda` block (`title`, `slug`, `engine`)
- `index.server.js` exporting `definePlugin(...)` as `pluginManifest` or `default`
- Optional: `admin/routes/`, `storefront/routes/`, `blocks/`, `i18n/<locale>.json`
