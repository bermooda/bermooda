# External Themes & Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract first-party themes/plugins into separate repos/npm packages; remove hardcoded bundled/legacy maps from the app; have `bermooda install` pull default theme + Meilisearch + one email provider.

**Architecture:** Packages live under `~/dev/bermooda/<repo>` and publish as `@bermooda/*`. The app discovers whatever is present under `app/themes/*` and `app/plugins/*` via `import.meta.glob`. The CLI installs packages onto disk and writes `activeTheme` / `enabledPlugins` through a shop script.

**Tech Stack:** React Router / Vite globs, Prisma settings, `@bermooda/cli` npm-pack install, GitHub + public npm.

**Spec:** [2026-07-29-external-themes-plugins-design.md](../specs/2026-07-29-external-themes-plugins-design.md)

**Auth note:** If `gh` / `npm publish` credentials are missing, complete local package trees + app/CLI wiring, and leave publish as a blocked checklist item. Contributor install must support `--path` to sibling checkouts until packages are on npm.

---

## File map

### New package roots (sibling of app)

| Path                     | npm name                       | slug          |
| ------------------------ | ------------------------------ | ------------- |
| `../theme-default/`      | `@bermooda/theme-default`      | `default`     |
| `../plugin-meilisearch/` | `@bermooda/plugin-meilisearch` | `meilisearch` |
| `../plugin-resend/`      | `@bermooda/plugin-resend`      | `resend`      |
| `../plugin-sendgrid/`    | `@bermooda/plugin-sendgrid`    | `sendgrid`    |
| `../plugin-aws-ses/`     | `@bermooda/plugin-aws-ses`     | `aws-ses`     |

### App (bermooda)

| File                                             | Responsibility                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `app/core/themes/index.server.js`                | Add `discoverThemes()`; drop legacy id normalize                                         |
| `app/core/themes/storefront-components/index.js` | Glob-discover themes (no hardcoded default import)                                       |
| `app/core/bootstrap/index.server.js`             | Call `discoverThemes()`; remove default theme import                                     |
| `app/core/extensions/package-meta.js`            | Remove `BUNDLED_*`, `LEGACY_*`, helpers                                                  |
| `app/core/i18n/index.server.js`                  | Resolve slugs from registries / on-disk package.json                                     |
| `app/core/plugins/index.server.js`               | Drop legacy normalize on enabled ids                                                     |
| Admin/API theme & plugin routes                  | Drop `normalizeLegacyIds`                                                                |
| `app/routes/storefront/apps/$pluginId.jsx`       | Use `getStorefrontComponent('StorefrontChrome')` (or Layout) instead of hardcoded import |
| `scripts/cli-set-extensions.mjs`                 | Set `activeTheme` + `enabledPlugins` via Prisma                                          |
| `scripts/install-default-extensions.mjs`         | Contributor helper (npm or sibling `--path`)                                             |
| `app/themes/.gitkeep`, `app/plugins/.gitkeep`    | Empty install targets                                                                    |
| Tests / email adapters test                      | Fixtures or relative paths after extraction                                              |

### CLI

| File                                   | Responsibility                                            |
| -------------------------------------- | --------------------------------------------------------- |
| `src/commands/install.js`              | Prompt/flag `--email-provider`; install + activate/enable |
| `src/lib/fs-install.js`                | Prefer `bermooda.slug` for folder id                      |
| `src/commands/plugin/index.js`         | Real `--enable` via shop script                           |
| `src/commands/theme/index.js`          | Real `--activate` via shop script                         |
| `src/lib/extensions-settings.js` (new) | Invoke shop `cli-set-extensions.mjs`                      |
| Tests                                  | Install email-provider mapping + settings helper          |

---

### Task 1: Extract package trees locally

**Files:** Create the five sibling directories under `/Users/cvgellhorn/dev/bermooda/`.

- [ ] **Step 1: Copy theme-default**

```bash
mkdir -p /Users/cvgellhorn/dev/bermooda/theme-default
rsync -a --exclude node_modules /Users/cvgellhorn/dev/bermooda/bermooda/app/themes/default/ \
  /Users/cvgellhorn/dev/bermooda/theme-default/
```

Ensure `package.json`:

```json
{
  "name": "@bermooda/theme-default",
  "version": "0.1.0",
  "description": "The default bermooda storefront theme.",
  "license": "MIT",
  "files": ["**/*"],
  "bermooda": {
    "title": "Default",
    "slug": "default",
    "engine": ">=0.1.0"
  }
}
```

Add minimal `README.md` + `.gitignore` (node_modules). Init git, commit.

- [ ] **Step 2: Copy meilisearch, resend, sendgrid**

Same pattern from `app/plugins/{meilisearch,resend,sendgrid}`. Keep package names; drop `"private": true`.

- [ ] **Step 3: Copy SES → plugin-aws-ses**

```bash
rsync -a bermooda/app/plugins/ses/ /Users/cvgellhorn/dev/bermooda/plugin-aws-ses/
```

Update:

- `package.json` `name` → `@bermooda/plugin-aws-ses`, `slug` → `aws-ses`
- `provider/index.server.js` `PLUGIN_ID` → `@bermooda/plugin-aws-ses`
- Any strings referencing `@bermooda/plugin-ses`

- [ ] **Step 4: Attempt GitHub repos + npm publish**

```bash
gh repo create bermooda/theme-default --private --source=. --remote=origin --push
# …repeat for each
npm publish --access public   # if npm auth available
```

If auth fails: document in PR checklist; packages remain local for `--path` installs.

- [ ] **Step 5: Commit each package repo**

---

### Task 2: Shop script to set extension settings

**Files:**

- Create: `bermooda/scripts/cli-set-extensions.mjs`
- Modify: `bermooda/package.json` (script entry)

- [ ] **Step 1: Implement script**

Env:

- `BERMOODA_ACTIVE_THEME` — package id (optional)
- `BERMOODA_ENABLED_PLUGINS` — comma-separated package ids (optional; replaces list)

Uses same Prisma bootstrap as seed (`dotenv`, generated client). Upserts Setting rows for `activeTheme` and `enabledPlugins`.

```js
// scripts/cli-set-extensions.mjs (sketch)
// read env, upsert Setting key/value JSON
```

- [ ] **Step 2: Wire npm script**

`"cli:set-extensions": "node scripts/cli-set-extensions.mjs"`

- [ ] **Step 3: Commit**

---

### Task 3: Remove package-meta maps + update call sites

**Files:**

- Modify: `app/core/extensions/package-meta.js`
- Modify: `app/core/extensions/package-meta.test.js`
- Modify: `app/core/i18n/index.server.js`, `app/core/i18n/index.test.server.js`
- Modify: `app/core/plugins/index.server.js`
- Modify: `app/core/themes/index.server.js`
- Modify: admin/API plugin & theme routes

- [ ] **Step 1: Strip maps from package-meta.js**

Keep: `SLUG_PATTERN`, `parseExtensionPackage`, `mergeExtensionPackage`, `assertSlugMatchesFolder`.

Remove: `LEGACY_*`, `BUNDLED_*`, `normalizeLegacyIds`, `resolveBundledSlug`.

- [ ] **Step 2: i18n slug resolution**

Use theme/plugin registry helpers:

- `getRegisteredTheme(id)?.slug` or scan `app/themes/*/package.json` for matching `name`
- Same for plugins via `getRegisteredPlugin` / folder package.json

Prefer registry after discovery; for message load during request, registries are already populated.

- [ ] **Step 3: Replace `normalizeLegacyIds(...)` with identity / Array.isArray guard**

```js
const enabledPlugins = Array.isArray(enabledPluginsRaw)
  ? enabledPluginsRaw
  : [];
```

- [ ] **Step 4: Update tests; run**

```bash
npx vitest run app/core/extensions/package-meta.test.js app/core/i18n/index.test.server.js
```

- [ ] **Step 5: Commit**

---

### Task 4: Theme discovery + drop hardcoded theme imports

**Files:**

- Modify: `app/core/themes/index.server.js` — `discoverThemes()`
- Modify: `app/core/themes/storefront-components/index.js` — glob
- Modify: `app/core/bootstrap/index.server.js` + test
- Modify: `app/routes/storefront/apps/$pluginId.jsx` + test
- Modify: `app/core/themes/storefront-components/index.test.js`
- Create fixtures under `app/test/fixtures/extensions/` if needed for unit tests

- [ ] **Step 1: Add discoverThemes (mirror discoverPlugins)**

```js
const themeModules = import.meta.glob('#/themes/*/index.js', { eager: true });
const themePackages = import.meta.glob('#/themes/*/package.json', {
  eager: true,
  import: 'default',
});

export function discoverThemes() {
  // merge, engine check, assertSlugMatchesFolder, registerTheme
}
```

Call from `registerBuiltins()` instead of importing default theme.

- [ ] **Step 2: storefront-components glob**

```js
const themeModules = import.meta.glob('#/themes/*/index.js', { eager: true });
const themePackages = import.meta.glob('#/themes/*/package.json', {
  eager: true,
  import: 'default',
});
// build THEMES map; getStorefrontComponent handles empty map (return null)
```

- [ ] **Step 3: $pluginId.jsx**

Replace hardcoded StorefrontChrome import with `getStorefrontComponent('StorefrontChrome', themeId)` (confirm component key in theme `index.js` — may be named differently; use whatever key exists, e.g. layout chrome).

- [ ] **Step 4: Empty dirs**

Remove `app/themes/default` and `app/plugins/*` from app after Task 1 copy verified. Add `.gitkeep` + short README.

- [ ] **Step 5: Contributor script `scripts/install-default-extensions.mjs`**

Installs theme-default, meilisearch, plugin-resend via:

1. Sibling path if `../theme-default` exists
2. Else `npm pack` / CLI `theme add` / `plugin add`

Then runs `cli-set-extensions.mjs`.

`package.json`: `"extensions:install": "node scripts/install-default-extensions.mjs"`

Document in `AGENTS.md` / README.

- [ ] **Step 6: Fix email adapters test** to import from fixture copies or skip if plugins absent; prefer copying provider test doubles into `app/libs/email/` tests without depending on `app/plugins`.

- [ ] **Step 7: Run targeted tests + lint**

- [ ] **Step 8: Commit**

---

### Task 5: CLI install + real enable/activate

**Files:** under `/Users/cvgellhorn/dev/bermooda/cli`

- [ ] **Step 1: Prefer `bermooda.slug` in `detectPackageId`**

```js
if (pkg.bermooda?.slug && SAFE_ID_RE.test(pkg.bermooda.slug)) {
  return pkg.bermooda.slug;
}
```

Also return package `name` separately where settings need full id — installExtension should expose `{ slug, packageId }` or read package.json after install.

- [ ] **Step 2: `src/lib/extensions-settings.js`**

```js
export async function setShopExtensions(
  shopRoot,
  { activeTheme, enabledPlugins }
) {
  // spawn node scripts/cli-set-extensions.mjs with env
}
```

- [ ] **Step 3: Wire `plugin add --enable` and `theme add --activate`**

- [ ] **Step 4: Update `install.js`**

After bootstrap:

```js
const emailProvider = args.emailProvider ?? (interactive ? await select… : 'resend');
const emailPkg = {
  resend: '@bermooda/plugin-resend',
  sendgrid: '@bermooda/plugin-sendgrid',
  'aws-ses': '@bermooda/plugin-aws-ses',
}[emailProvider];

// theme add @bermooda/theme-default --activate
// plugin add @bermooda/plugin-meilisearch --enable
// plugin add ${emailPkg} --enable
```

Support `--path` fallbacks via env `BERMOODA_EXTENSIONS_PATH` pointing at sibling dir parent for local smoke before npm publish.

- [ ] **Step 5: Help text + tests**

- [ ] **Step 6: Commit**

---

### Task 6: Docs + cleanup references

- [ ] Update `.cursor/rules/email-providers.mdc`, `.env.example`, `docs/plugins.md`, `docs/themes.md` for external packages and `@bermooda/plugin-aws-ses`
- [ ] Update AGENTS.md contributor flow (`npm run extensions:install`)
- [ ] Commit

---

### Task 7: Validate and open PRs

**App preflight (bermooda):**

```bash
npm run extensions:install   # from sibling paths
npm run lint
npm run build
npm run test                 # or targeted subset
```

**CLI:**

```bash
npm test
```

Push branches and `gh pr create` for:

1. bermooda app branch
2. cli branch
3. Each extension repo (or single note if publish blocked)

---

## Spec coverage checklist

| Spec item                                 | Task                  |
| ----------------------------------------- | --------------------- |
| Five packages / repos                     | 1                     |
| Remove BUNDLED/LEGACY                     | 3                     |
| discoverThemes + no bootstrap hard import | 4                     |
| Empty app themes/plugins                  | 4                     |
| CLI install theme+meili+email             | 5                     |
| Resend default / aws-ses flag             | 5                     |
| Real enable/activate                      | 2, 5                  |
| Contributor script                        | 4                     |
| Docs                                      | 6                     |
| Publish                                   | 1 (may block on auth) |
