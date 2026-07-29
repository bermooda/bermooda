# app/themes/

This directory is the install target for storefront themes. It is intentionally empty in the repository.

## Installing themes

**Contributors / local dev:**

```bash
npm run extensions:install
```

This copies the default theme from the sibling `../theme-default` checkout (or falls back to npm pack).

**Production / CLI install:**

```bash
bermooda install        # interactive — prompts for email provider
bermooda install -y     # non-interactive — uses Resend as email provider
```

The CLI installs `@bermooda/theme-default` here and activates it.

## Package contract

Each theme lives in a subdirectory matching its `bermooda.slug` (e.g. `app/themes/default/`). The directory must contain:

- `package.json` with a `bermooda` block (`title`, `slug`, `engine`)
- `index.js` exporting `defineTheme({ components })`
- Optional: `i18n/<locale>.json` message catalogs
