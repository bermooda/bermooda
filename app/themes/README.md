# app/themes/

This directory is the install target for storefront themes. It is intentionally empty in the repository.

## Installing themes

**Contributors / local dev:**

```bash
npm run extensions:install
```

This copies the default theme from the sibling `../theme-default` checkout (or falls back to npm pack), then installs that theme's own `package.json` dependencies into `app/themes/<slug>/node_modules`.

**Production / CLI install:**

```bash
bermooda install        # interactive — prompts for email provider
bermooda install -y     # non-interactive — uses Resend as email provider
```

The CLI installs `@bermooda/theme-default` here, runs `npm install` in the theme folder for its dependencies, and activates it.

## Package contract

Each theme lives in a subdirectory matching its `bermooda.slug` (e.g. `app/themes/default/`). The directory must contain:

- `package.json` with a `bermooda` block (`title`, `slug`, `engine`)
- `index.js` exporting `defineTheme({ components })`
- Optional: `i18n/<locale>.json` message catalogs

## Dependencies

Themes may declare their own npm `dependencies` / `optionalDependencies` in `package.json`. Shared runtime libraries used by the shop (`react`, `react-dom`, `react-router`, etc.) should be `peerDependencies` so they resolve from the shop root.

Before `npm run build`, `prebuild` runs `npm run extensions:install-deps` so nested `node_modules` exist. Vite lists those runtime dependency names in `ssr.noExternal` so they are bundled into `build/server` (nested `node_modules` are build inputs, not required at runtime in the production image).
