# Package.json Plugin/Theme Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plugin/theme `manifest.js` files with `package.json` identity metadata (`bermooda.title` / `bermooda.slug`), auto-merge that metadata at discovery time, and use slug for URLs while keeping the full package `name` as registry `id`.

**Architecture:** A shared client-safe helper parses `package.json` → `{ id, title, version, description, slug, settings? }`. Plugin discovery globs `#/plugins/*/index.server.js` + sibling `package.json`, merges with `definePlugin` runtime exports, and registers by `id` with a slug index. Themes export `defineTheme({ components })` from `index.js`; bootstrap and the storefront component registry merge the same package metadata. Persist enablement / `activeTheme` as full ids; route params and filesystem paths use slugs.

**Tech Stack:** React Router 7, Vite `import.meta.glob` + JSON imports, Vitest, existing `#/core/plugins` and `#/core/themes` registries.

**Spec:** [docs/superpowers/specs/2026-07-25-package-json-plugin-theme-manifest-design.md](../specs/2026-07-25-package-json-plugin-theme-manifest-design.md)

## Global Constraints

- `id` = full `package.json` `name` including scope (e.g. `@bermooda/sample-analytics`).
- Display name = `bermooda.title` (required); never use npm `name` as the UI title.
- `bermooda.slug` required; must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- URLs and route params use **slug** only; settings persistence uses **id**.
- First-party folder name under `app/plugins/<slug>/` and `app/themes/<slug>/` must equal `bermooda.slug`.
- Theme entry is client-safe `index.js`; plugin entry remains `index.server.js`.
- Authors must not pass identity fields into `definePlugin` / `defineTheme`.
- Do not add npm-install-at-runtime for third-party packages in this change.
- In `app/`, JavaScript + JSDoc; `#/*` imports; no file extensions in imports.

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/core/extensions/package-meta.js` | Parse/validate/merge `package.json`; slug pattern; legacy id maps |
| `app/core/extensions/package-meta.test.js` | Unit tests for package-meta |
| `app/core/plugins/index.server.js` | Runtime-only `definePlugin`; discover+merge; slug index; legacy normalize on read |
| `app/core/plugins/manifest.js` | Update required field constants (`title`/`slug` instead of `name`) |
| `app/core/themes/index.server.js` | Runtime-only `defineTheme`; merge on register; slug index |
| `app/core/themes/manifest.js` | Required fields: `id`, `title`, `version`, `components`, `slug` |
| `app/core/themes/storefront-components/index.js` | Import theme `index.js` + `package.json`, merge, key by id |
| `app/core/bootstrap/index.server.js` | Register default theme from `index.js` + `package.json` |
| `app/core/i18n/index.server.js` | Resolve theme/plugin filesystem paths via **slug** |
| `app/core/settings/defaults.js` | `DEFAULT_ACTIVE_THEME` → `@bermooda/theme-default` |
| `app/plugins/*/package.json` | Identity for each plugin |
| `app/plugins/*/index.server.js` | Drop manifest imports; runtime-only `definePlugin` |
| `app/themes/default/package.json` | Identity for default theme |
| `app/themes/default/index.js` | `defineTheme({ components })` (replaces `manifest.js`) |
| Admin/storefront plugin routes | Resolve by slug; display `title` |
| `docs/plugins.md`, `docs/themes.md`, `.cursor/rules/ecommerce-architecture.mdc` | Document contract |

Delete after migration: all `app/plugins/*/manifest.js`, `app/themes/default/manifest.js`.

---

### Task 1: Shared `package-meta` helper

**Files:**
- Create: `app/core/extensions/package-meta.js`
- Create: `app/core/extensions/package-meta.test.js`

**Interfaces:**
- Produces:
  - `SLUG_PATTERN` — `RegExp`
  - `LEGACY_PLUGIN_ID_MAP` — `Record<string, string>`
  - `LEGACY_THEME_ID_MAP` — `Record<string, string>`
  - `parseExtensionPackage(pkg: unknown) => ExtensionPackageMeta` (throws on invalid)
  - `mergeExtensionPackage(pkg: unknown, runtime?: object) => object`
  - `normalizeLegacyIds(ids: string[], map: Record<string, string>) => string[]`
  - `assertSlugMatchesFolder(slug: string, folderName: string, kind: string) => void`

- [ ] **Step 1: Write the failing tests**

```js
// app/core/extensions/package-meta.test.js
import { describe, expect, it } from 'vitest';
import {
  LEGACY_PLUGIN_ID_MAP,
  LEGACY_THEME_ID_MAP,
  assertSlugMatchesFolder,
  mergeExtensionPackage,
  normalizeLegacyIds,
  parseExtensionPackage,
} from '#/core/extensions/package-meta';

const validPkg = {
  name: '@bermooda/sample-analytics',
  version: '1.0.0',
  description: 'Captures events',
  bermooda: {
    title: 'Sample Analytics',
    slug: 'sample-analytics',
  },
};

describe('parseExtensionPackage', () => {
  it('maps name/version/description/title/slug', () => {
    expect(parseExtensionPackage(validPkg)).toEqual({
      id: '@bermooda/sample-analytics',
      version: '1.0.0',
      description: 'Captures events',
      title: 'Sample Analytics',
      slug: 'sample-analytics',
    });
  });

  it('includes bermooda.settings when present', () => {
    const settings = [{ key: 'apiKey', label: 'API Key', type: 'text' }];
    expect(
      parseExtensionPackage({
        ...validPkg,
        bermooda: { ...validPkg.bermooda, settings },
      }).settings
    ).toEqual(settings);
  });

  it('throws when name/version/title/slug missing', () => {
    expect(() => parseExtensionPackage({ ...validPkg, name: '' })).toThrow(
      /name/
    );
    expect(() =>
      parseExtensionPackage({
        ...validPkg,
        bermooda: { title: 'X', slug: '' },
      })
    ).toThrow(/slug/);
  });

  it('throws when slug is not lowercase-hyphenated', () => {
    expect(() =>
      parseExtensionPackage({
        ...validPkg,
        bermooda: { title: 'X', slug: 'Sample_Analytics' },
      })
    ).toThrow(/slug/);
  });
});

describe('mergeExtensionPackage', () => {
  it('lets package identity win over runtime fields', () => {
    const merged = mergeExtensionPackage(validPkg, {
      id: 'wrong',
      title: 'Wrong',
      hooks: { 'order.created': () => {} },
    });
    expect(merged.id).toBe('@bermooda/sample-analytics');
    expect(merged.title).toBe('Sample Analytics');
    expect(merged.hooks['order.created']).toBeTypeOf('function');
  });
});

describe('normalizeLegacyIds', () => {
  it('rewrites known short plugin ids', () => {
    expect(
      normalizeLegacyIds(['sample-analytics', '@acme/other'], LEGACY_PLUGIN_ID_MAP)
    ).toEqual(['@bermooda/sample-analytics', '@acme/other']);
  });

  it('rewrites legacy default theme id', () => {
    expect(normalizeLegacyIds(['default'], LEGACY_THEME_ID_MAP)).toEqual([
      '@bermooda/theme-default',
    ]);
  });
});

describe('assertSlugMatchesFolder', () => {
  it('throws when folder !== slug', () => {
    expect(() =>
      assertSlugMatchesFolder('sample-analytics', 'other', 'plugin')
    ).toThrow(/sample-analytics/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test -- app/core/extensions/package-meta.test.js`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement helper**

```js
// app/core/extensions/package-meta.js
/** @typedef {{ id: string, title: string, version: string, description?: string, slug: string, settings?: unknown }} ExtensionPackageMeta */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const LEGACY_PLUGIN_ID_MAP = {
  'sample-analytics': '@bermooda/sample-analytics',
  'fraud-guard': '@bermooda/fraud-guard',
  meilisearch: '@bermooda/meilisearch',
};

export const LEGACY_THEME_ID_MAP = {
  default: '@bermooda/theme-default',
};

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Extension package missing required field: "${label}"`);
  }
  return value.trim();
}

/**
 * @param {unknown} pkg
 * @returns {ExtensionPackageMeta}
 */
export function parseExtensionPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    throw new Error('Extension package.json must be an object');
  }

  const bermooda =
    /** @type {{ title?: unknown, slug?: unknown, settings?: unknown }} */ (
      /** @type {Record<string, unknown>} */ (pkg).bermooda
    );
  if (!bermooda || typeof bermooda !== 'object') {
    throw new Error('Extension package.json missing required "bermooda" object');
  }

  const id = requireNonEmptyString(
    /** @type {Record<string, unknown>} */ (pkg).name,
    'name'
  );
  const version = requireNonEmptyString(
    /** @type {Record<string, unknown>} */ (pkg).version,
    'version'
  );
  const title = requireNonEmptyString(bermooda.title, 'bermooda.title');
  const slug = requireNonEmptyString(bermooda.slug, 'bermooda.slug');

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Extension package bermooda.slug must be lowercase hyphenated, got "${slug}"`
    );
  }

  /** @type {ExtensionPackageMeta} */
  const meta = { id, version, title, slug };

  const description = /** @type {Record<string, unknown>} */ (pkg).description;
  if (typeof description === 'string' && description.trim()) {
    meta.description = description.trim();
  }
  if (bermooda.settings !== undefined) {
    meta.settings = bermooda.settings;
  }

  return meta;
}

/**
 * @param {unknown} pkg
 * @param {Record<string, unknown>} [runtime]
 * @returns {Record<string, unknown>}
 */
export function mergeExtensionPackage(pkg, runtime = {}) {
  const meta = parseExtensionPackage(pkg);
  return {
    ...runtime,
    ...meta,
    settings: meta.settings ?? runtime.settings,
  };
}

/**
 * @param {string[]} ids
 * @param {Record<string, string>} map
 * @returns {string[]}
 */
export function normalizeLegacyIds(ids, map) {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => map[id] ?? id);
}

/**
 * @param {string} slug
 * @param {string} folderName
 * @param {string} kind
 */
export function assertSlugMatchesFolder(slug, folderName, kind) {
  if (slug !== folderName) {
    throw new Error(
      `${kind} folder "${folderName}" must match bermooda.slug "${slug}"`
    );
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm run test -- app/core/extensions/package-meta.test.js`

- [ ] **Step 5: Commit**

```bash
git add app/core/extensions/package-meta.js app/core/extensions/package-meta.test.js
git commit -m "feat: add extension package.json metadata helper"
```

---

### Task 2: Plugin `package.json` files + runtime-only entries

**Files:**
- Create: `app/plugins/sample-analytics/package.json`
- Create: `app/plugins/fraud-guard/package.json`
- Create: `app/plugins/meilisearch/package.json`
- Modify: `app/plugins/sample-analytics/index.server.js`
- Modify: `app/plugins/fraud-guard/index.server.js`
- Modify: `app/plugins/meilisearch/index.server.js`
- Modify: `app/plugins/sample-analytics/data/index.server.js` (stop importing manifest; hardcode or import package id constant from package.json)
- Delete: `app/plugins/*/manifest.js` (after Task 3 wires discovery — delete in Task 3 if tests still import manifests)

**Interfaces:**
- Consumes: none from Task 1 yet in plugin files themselves
- Produces: each plugin root has valid `package.json`; `definePlugin({ hooks|blocks|providers... })` only

- [ ] **Step 1: Add package.json for each plugin**

`app/plugins/sample-analytics/package.json`:

```json
{
  "name": "@bermooda/sample-analytics",
  "version": "1.0.0",
  "description": "Captures order.created events and surfaces them in admin and storefront pages.",
  "private": true,
  "bermooda": {
    "title": "Sample Analytics",
    "slug": "sample-analytics"
  }
}
```

`app/plugins/fraud-guard/package.json`:

```json
{
  "name": "@bermooda/fraud-guard",
  "version": "1.0.0",
  "description": "Blocks fulfillment of orders on a fraud hold.",
  "private": true,
  "bermooda": {
    "title": "Fraud Guard",
    "slug": "fraud-guard"
  }
}
```

`app/plugins/meilisearch/package.json`:

```json
{
  "name": "@bermooda/meilisearch",
  "version": "1.0.0",
  "description": "External search engine provider for fast faceted product search on large catalogs.",
  "private": true,
  "bermooda": {
    "title": "Meilisearch",
    "slug": "meilisearch"
  }
}
```

- [ ] **Step 2: Strip identity from plugin entries**

Example `sample-analytics/index.server.js` — remove `import manifest` and spread:

```js
export const pluginManifest = definePlugin({
  hooks: defineHooks({
    'order.created': handleOrderCreated,
  }),
  blocks: {
    'product.afterDescription': ProductAfterDescriptionBlock,
    'dashboard.widgets': DashboardWidgetsBlock,
  },
});

export default pluginManifest;
```

Apply the same pattern to `fraud-guard` and `meilisearch` (runtime fields only).

- [ ] **Step 3: Fix `sample-analytics/data/index.server.js`**

Replace `import manifest from '.../manifest'` with:

```js
import pkg from '#/plugins/sample-analytics/package.json';

const PLUGIN_ID = pkg.name;
```

Use `PLUGIN_ID` wherever `manifest.id` was used.

- [ ] **Step 4: Commit package files + entry edits (keep manifest.js until discovery migrates)**

```bash
git add app/plugins/
git commit -m "feat: add plugin package.json and drop identity from definePlugin calls"
```

---

### Task 3: Plugin engine — merge on discover, slug index, legacy ids

**Files:**
- Modify: `app/core/plugins/index.server.js`
- Modify: `app/core/plugins/manifest.js`
- Modify: `app/core/plugins/index.test.server.js`
- Modify: plugin unit tests that assert `id: 'sample-analytics'` etc.
- Delete: `app/plugins/*/manifest.js`

**Interfaces:**
- Consumes: `mergeExtensionPackage`, `assertSlugMatchesFolder`, `normalizeLegacyIds`, `LEGACY_PLUGIN_ID_MAP` from `#/core/extensions/package-meta`
- Produces:
  - `definePlugin(runtime)` — no longer requires `id`/`name`/`version`
  - `discoverPlugins()` — merges package.json
  - `getRegisteredPluginBySlug(slug) => PluginManifest | null`
  - `getEnabledPluginIds()` — returns ids after legacy normalization
  - Registered manifest shape: `{ id, title, version, description?, slug, hooks?, ... }` (no `name`, no `adminRoutes`/`storefrontRoutes` required)

- [ ] **Step 1: Update failing expectations in `index.test.server.js`**

Change helpers that build manifests from `name` → `title` + add `slug`. Example:

```js
function validPlugin(overrides = {}) {
  return {
    id: '@bermooda/test-plugin',
    title: 'Test Plugin',
    version: '1.0.0',
    slug: 'test-plugin',
    ...overrides,
  };
}
```

Update `definePlugin` tests: passing only `{ hooks: {} }` should succeed; missing identity is OK for `definePlugin`, but `register(validPlugin())` still requires full identity.

Add tests:

```js
it('getRegisteredPluginBySlug returns plugin registered under slug', () => {
  register(validPlugin());
  expect(getRegisteredPluginBySlug('test-plugin')?.id).toBe(
    '@bermooda/test-plugin'
  );
});

it('getEnabledPluginIds rewrites legacy short ids', async () => {
  settingsGet.mockResolvedValueOnce(['sample-analytics']);
  await expect(getEnabledPluginIds()).resolves.toEqual([
    '@bermooda/sample-analytics',
  ]);
});
```

- [ ] **Step 2: Run targeted tests — expect FAIL**

Run: `npm run test -- app/core/plugins/index.test.server.js`

- [ ] **Step 3: Implement engine changes**

In `app/core/plugins/manifest.js`:

```js
export const REQUIRED_MANIFEST_FIELDS = ['id', 'title', 'version', 'slug'];
```

In `index.server.js`:

1. Update `PluginManifest` typedef: `title`, `slug`; remove reliance on `name`; drop required `adminRoutes`/`storefrontRoutes`.
2. `definePlugin(runtime)` — validate object + optional `providers` only; return `runtime`.
3. Add `validateRegisteredPlugin(manifest)` used by `register` that checks `REQUIRED_MANIFEST_FIELDS` and slug pattern.
4. Add `const slugIndex = new Map()` — on `register`, `slugIndex.set(manifest.slug, manifest.id)`; clear in any test reset helper.
5. Export `getRegisteredPluginBySlug(slug)`.
6. `getEnabledPluginIds`:

```js
export async function getEnabledPluginIds() {
  const enabledRaw = await settingsGet('enabledPlugins');
  const enabled = Array.isArray(enabledRaw) ? enabledRaw : [];
  return normalizeLegacyIds(enabled, LEGACY_PLUGIN_ID_MAP);
}
```

7. Also normalize `pluginOrder` reads used for sorting/i18n at the call sites that read raw settings, or add `getPluginOrderIds()` that normalizes — prefer normalizing inside `sortPluginsByOrder` callers by mapping order through `normalizeLegacyIds` when loading in admin loader / i18n (Task 5/6). For enable path, normalization in `getEnabledPluginIds` is enough for startup.

8. Replace `discoverPlugins`:

```js
const pluginModules = import.meta.glob('#/plugins/*/index.server.js', {
  eager: true,
});
const pluginPackages = import.meta.glob('#/plugins/*/package.json', {
  eager: true,
  import: 'default',
});

function pluginFolderFromPath(modulePath) {
  const match = modulePath.match(/\/plugins\/([^/]+)\//);
  if (!match) {
    throw new Error(`Cannot parse plugin folder from "${modulePath}"`);
  }
  return match[1];
}

export function discoverPlugins() {
  const seenSlugs = new Set();

  for (const [modPath, mod] of Object.entries(pluginModules)) {
    const folder = pluginFolderFromPath(modPath);
    const pkgEntry = Object.entries(pluginPackages).find(([pkgPath]) =>
      pkgPath.includes(`/plugins/${folder}/`)
    );
    if (!pkgEntry) {
      throw new Error(`Missing package.json for plugin folder "${folder}"`);
    }
    const pkg = pkgEntry[1];
    const runtime = mod.pluginManifest ?? mod.default ?? {};
    const manifest = mergeExtensionPackage(pkg, runtime);
    assertSlugMatchesFolder(manifest.slug, folder, 'plugin');
    if (seenSlugs.has(manifest.slug)) {
      throw new Error(`Duplicate plugin slug "${manifest.slug}"`);
    }
    seenSlugs.add(manifest.slug);
    register(manifest);
  }
}
```

9. `register(manifest)` must call identity validation (not `definePlugin` alone).

- [ ] **Step 4: Delete plugin `manifest.js` files; fix remaining plugin tests**

Update any test that imports `#/plugins/.../manifest` or expects `id: 'sample-analytics'` / `name:` to use package ids and `title`.

- [ ] **Step 5: Run plugin tests**

Run: `npm run test -- app/core/plugins app/plugins`

- [ ] **Step 6: Commit**

```bash
git add app/core/plugins app/plugins app/core/extensions
git commit -m "feat: discover plugins from package.json with slug index"
```

---

### Task 4: Theme `package.json` + `index.js` + engine

**Files:**
- Create: `app/themes/default/package.json`
- Create: `app/themes/default/index.js` (move component map from `manifest.js`)
- Delete: `app/themes/default/manifest.js`
- Modify: `app/core/themes/manifest.js`
- Modify: `app/core/themes/index.server.js`
- Modify: `app/core/themes/index.test.server.js`
- Modify: `app/core/themes/storefront-components/index.js`
- Modify: `app/core/themes/storefront-components/index.test.js` (if any)
- Modify: `app/core/bootstrap/index.server.js`

**Interfaces:**
- Consumes: `mergeExtensionPackage`, `LEGACY_THEME_ID_MAP`, `normalizeLegacyIds`
- Produces:
  - `defineTheme({ components, settings? })` — requires `components` only (plus optional runtime settings)
  - `registerTheme` accepts either full manifest or merges when bootstrap passes pkg+runtime
  - `getRegisteredThemeBySlug(slug)`
  - Default theme id `@bermooda/theme-default`, slug `default`

- [ ] **Step 1: Add theme package.json**

```json
{
  "name": "@bermooda/theme-default",
  "version": "1.0.0",
  "description": "The default bermooda storefront theme.",
  "private": true,
  "bermooda": {
    "title": "Default",
    "slug": "default"
  }
}
```

- [ ] **Step 2: Create `app/themes/default/index.js`**

Move all component imports from `manifest.js`. Export:

```js
import { defineTheme } from '#/core/themes/index.server';
// NOTE: defineTheme must be importable from a client-safe path OR index.js must not import .server

```

**Critical:** `#/core/themes/index.server` cannot be imported from client-bundled `themes/default/index.js`.

Resolution used by this plan:

1. Move `defineTheme` (validation only) to client-safe `#/core/themes/define.js` (or keep validation inline in theme `index.js` and validate again in `registerTheme` on the server).
2. Preferred: create `app/core/themes/define.js` with `defineTheme` that only checks `components` + required component names (import `REQUIRED_COMPONENTS` from `#/core/themes/manifest`).
3. `index.server.js` re-exports `defineTheme` from `./define` for server callers.
4. Theme `index.js` imports `defineTheme` from `#/core/themes/define`.

```js
// app/themes/default/index.js
import { defineTheme } from '#/core/themes/define';
import Layout from '#/themes/default/components/layout';
// ... all other component imports from former manifest.js

export default defineTheme({
  components: {
    Layout,
    HomePage,
    // ...same keys as former manifest.js
  },
});
```

- [ ] **Step 3: Update theme tests for new shape**

`validManifest` helper:

```js
function validManifest(overrides = {}) {
  return {
    id: '@bermooda/test-theme',
    title: 'Test Theme',
    version: '1.0.0',
    slug: 'test-theme',
    components: Object.fromEntries(
      REQUIRED_COMPONENTS.map((name) => [name, () => null])
    ),
    ...overrides,
  };
}
```

`defineTheme` tests: succeed with `{ components: {...} }` only; `registerTheme(validManifest())` still needs full identity.

Add `getRegisteredThemeBySlug` test.

- [ ] **Step 4: Implement theme engine + storefront registry + bootstrap**

`app/core/themes/manifest.js`:

```js
export const REQUIRED_MANIFEST_FIELDS = [
  'id',
  'title',
  'version',
  'slug',
  'components',
];
```

`app/core/themes/define.js` — `defineTheme(runtime)` validates `components` object includes every `REQUIRED_COMPONENTS` entry; does **not** require id/title/version/slug.

`registerTheme(manifest)` validates full merged manifest (identity + components), stores in `_registry` by `id`, maintains `_slugIndex`, calls `registerStorefrontTheme(manifest)`.

Add helper used by bootstrap/storefront:

```js
// Can live in package-meta usage sites:
import defaultRuntime from '#/themes/default/index';
import defaultPkg from '#/themes/default/package.json';
import { mergeExtensionPackage } from '#/core/extensions/package-meta';

const defaultTheme = mergeExtensionPackage(defaultPkg, defaultRuntime);
registerTheme(defaultTheme);
```

`storefront-components/index.js`:

```js
import defaultRuntime from '#/themes/default/index';
import defaultPkg from '#/themes/default/package.json';
import { mergeExtensionPackage } from '#/core/extensions/package-meta';

const defaultThemeManifest = mergeExtensionPackage(defaultPkg, defaultRuntime);

const THEMES = {
  [defaultThemeManifest.id]: defaultThemeManifest,
};

export function getStorefrontComponent(name, themeId = defaultThemeManifest.id) {
  const manifest =
    THEMES[themeId] ??
    THEMES[defaultThemeManifest.id] ??
    defaultThemeManifest;
  return (
    manifest.components[name] ??
    defaultThemeManifest.components[name] ??
    null
  );
}
```

Normalize legacy theme ids when resolving active theme:

```js
// in resolveActiveTheme / preloadStorefrontTheme after reading DB value:
const rawId = setting?.value ?? null;
const themeId = rawId
  ? (normalizeLegacyIds([rawId], LEGACY_THEME_ID_MAP)[0] ?? rawId)
  : null;
```

Default fallback when unset: `@bermooda/theme-default` (via `DEFAULT_ACTIVE_THEME` in Task 5).

- [ ] **Step 5: Delete `app/themes/default/manifest.js`; fix imports**

- [ ] **Step 6: Run theme tests**

Run: `npm run test -- app/core/themes app/core/bootstrap`

- [ ] **Step 7: Commit**

```bash
git add app/themes app/core/themes app/core/bootstrap
git commit -m "feat: load themes from package.json and index.js"
```

---

### Task 5: Settings defaults, seed, i18n paths

**Files:**
- Modify: `app/core/settings/defaults.js`
- Modify: `app/test/factories/setting.js`
- Modify: `prisma/seed.js`
- Modify: `app/core/i18n/index.server.js`
- Modify: `app/core/i18n/index.test.server.js`

**Interfaces:**
- Consumes: `getRegisteredTheme`, `getRegisteredPlugin`, slug fields; `normalizeLegacyIds` / maps
- Produces: defaults and seed use full package ids; i18n joins `themes/<slug>/i18n` and `plugins/<slug>/i18n`

- [ ] **Step 1: Update defaults and seed**

```js
// app/core/settings/defaults.js
export const DEFAULT_ACTIVE_THEME = '@bermooda/theme-default';
```

```js
// prisma/seed.js — enabledPlugins / pluginOrder
await upsertSetting('pluginOrder', ['@bermooda/sample-analytics']);
await upsertSetting('enabledPlugins', ['@bermooda/sample-analytics']);
```

`app/test/factories/setting.js`: `activeTheme: '@bermooda/theme-default'`.

- [ ] **Step 2: Update i18n loader**

```js
import {
  getRegisteredPlugin,
  listRegisteredPlugins,
} from '#/core/plugins/index.server';
import { getRegisteredTheme } from '#/core/themes/index.server';
import {
  LEGACY_PLUGIN_ID_MAP,
  LEGACY_THEME_ID_MAP,
  normalizeLegacyIds,
} from '#/core/extensions/package-meta';

// inside loadMessages cache callback:
const [activeThemeRaw, pluginOrderRaw] = await Promise.all([
  settingsGet('activeTheme'),
  settingsGet('pluginOrder'),
]);

const activeThemeId = activeThemeRaw
  ? normalizeLegacyIds([activeThemeRaw], LEGACY_THEME_ID_MAP)[0]
  : null;
const themeSlug = activeThemeId
  ? (getRegisteredTheme(activeThemeId)?.slug ?? null)
  : null;

const pluginIds = normalizeLegacyIds(
  Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [],
  LEGACY_PLUGIN_ID_MAP
);
const pluginSlugs = pluginIds
  .map((id) => getRegisteredPlugin(id)?.slug)
  .filter(Boolean);

const filePaths = [
  join(APP_DIR, 'core', 'i18n', 'messages', `${locale}.json`),
  ...(themeSlug
    ? [join(APP_DIR, 'themes', themeSlug, 'i18n', `${locale}.json`)]
    : []),
  ...pluginSlugs.map((slug) =>
    join(APP_DIR, 'plugins', slug, 'i18n', `${locale}.json`)
  ),
];
```

Avoid circular import issues: if i18n ↔ plugins cycle appears, resolve theme/plugin slug via a tiny lookup passed in, or read slug from registry modules carefully. Today plugins already import i18n `translate` — prefer looking up registries that do not import i18n at module top in a cycle. If needed, duplicate a narrow slug resolution that only reads the theme/plugin Maps through existing getters (plugins importing i18n is OK if i18n imports plugins lazily inside the async function — **dynamic import is disallowed by repo rules**; keep static imports and break cycles by moving `translate` usage or registry getters). Check for cycles after edit; if `plugins/index.server` → `i18n` → `plugins/index.server`, move `getRegisteredPlugin` slug lookup to a small `app/core/plugins/registry-lookup.server.js` or use filesystem slug = legacy path only for bundled packages. **Preferred cycle break:** i18n continues to treat `pluginOrder` / `activeTheme` values as **slugs when they don't contain `/`**, and as ids otherwise — simpler approach that avoids importing registries:

```js
function extensionDirName(idOrSlug) {
  if (!idOrSlug) return null;
  // scoped package id → cannot be a folder; look up not available → require slug in pluginOrder for i18n
}
```

**Chosen approach for this plan (no cycle):** store and seed **ids** in settings; i18n imports only `#/core/extensions/package-meta` maps plus a new tiny client-safe map of first-party id→slug constants exported from `package-meta.js`:

```js
export const BUNDLED_PLUGIN_SLUGS = {
  '@bermooda/sample-analytics': 'sample-analytics',
  '@bermooda/fraud-guard': 'fraud-guard',
  '@bermooda/meilisearch': 'meilisearch',
};
export const BUNDLED_THEME_SLUGS = {
  '@bermooda/theme-default': 'default',
};

export function resolveBundledSlug(id, table) {
  if (!id) return null;
  if (table[id]) return table[id];
  // already a slug?
  if (SLUG_PATTERN.test(id)) return id;
  return null;
}
```

Use that in i18n (no plugin registry import). Document that third-party packages will need registry-based resolution in a later change — acceptable under non-goals.

- [ ] **Step 3: Fix i18n tests** for new activeTheme ids / slug paths

- [ ] **Step 4: Run tests**

Run: `npm run test -- app/core/i18n app/core/settings`

- [ ] **Step 5: Commit**

```bash
git add app/core/settings app/core/i18n app/core/extensions app/test/factories/setting.js prisma/seed.js
git commit -m "feat: persist extension package ids; resolve i18n via slugs"
```

---

### Task 6: Routes and admin UI (`title` + slug URLs)

**Files:**
- Modify: `app/routes/admin/plugins/index.jsx`
- Modify: `app/routes/admin/plugins/$pluginId.jsx`
- Modify: `app/routes/admin/plugins/index.test.jsx` / `$pluginId.test.jsx`
- Modify: `app/routes/storefront/apps/$pluginId.jsx`
- Modify: `app/routes/storefront/apps/$pluginId.test.jsx`
- Modify: `app/routes/admin/themes/index.jsx`
- Modify: any `Link`/`to=` that embeds plugin id

**Interfaces:**
- Consumes: `getRegisteredPluginBySlug`, manifest.`title`, manifest.`slug`, manifest.`id`
- Produces: URL param is slug; enable/disable still passes **id**; UI shows **title** (and optionally monospace **id**)

- [ ] **Step 1: Update admin plugin dispatcher**

In `$pluginId.jsx` loader:

```js
const { pluginId: pluginSlug } = params;
const manifest = getRegisteredPluginBySlug(pluginSlug);
// enabled checks use manifest.id
if (!(await isPluginEnabled(manifest.id))) { ... }
```

Replace `manifest.name` with `manifest.title` in UI.

Route registry resolution already keys by folder slug — keep using `pluginSlug` for `resolveAdminRoute(pluginSlug, ...)`.

Remove checks that require `manifest.adminRoutes` / `manifest.storefrontRoutes`; use route registry only:

```js
if (!resolveAdminRoute(pluginSlug, splatPath)) {
  // no-match / no-routes
}
```

- [ ] **Step 2: Update storefront apps dispatcher the same way**

- [ ] **Step 3: Update admin plugins list**

- Sort by `a.title.localeCompare(b.title)`.
- Render `manifest.title`.
- Links: `to={\`/admin/plugins/${manifest.slug}\`}`.
- Enable/disable / settings actions submit `manifest.id` (hidden input) so persistence stays id-based.
- Optionally show `manifest.id` as secondary mono text for ownership.

Normalize `pluginOrder` when loading:

```js
const pluginOrder = normalizeLegacyIds(
  Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [],
  LEGACY_PLUGIN_ID_MAP
);
```

- [ ] **Step 4: Update admin themes UI** — `manifest.name` → `manifest.title`; activation continues to set full `manifest.id`.

- [ ] **Step 5: Run route tests**

Run: `npm run test -- app/routes/admin/plugins app/routes/storefront/apps app/routes/admin/themes`

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin/plugins app/routes/storefront/apps app/routes/admin/themes
git commit -m "feat: use plugin/theme slugs in URLs and title in admin UI"
```

---

### Task 7: Docs and architecture rules

**Files:**
- Modify: `docs/plugins.md`
- Modify: `docs/themes.md`
- Modify: `.cursor/rules/ecommerce-architecture.mdc`
- Modify: `docs/superpowers/specs/2026-07-25-package-json-plugin-theme-manifest-design.md` (status → Approved)

**Content requirements:**
- Document `package.json` contract and field table.
- Explicitly state: **id = full package name**; **URLs use `bermooda.slug`** (lowercase hyphens).
- `definePlugin` / `defineTheme` examples without identity fields.
- Theme components registered via `index.js` + `defineTheme({ components })`.
- Folder layout without `manifest.js`.
- Update architecture rule bullets that mention `manifest.js`.

- [ ] **Step 1: Edit docs/plugins.md and docs/themes.md** to match the spec sections “Package.json contract”, “Plugins”, “Themes”.

- [ ] **Step 2: Update `.cursor/rules/ecommerce-architecture.mdc`**

Replace manifest bullets with package.json + entry file names.

- [ ] **Step 3: Commit**

```bash
git add docs .cursor/rules/ecommerce-architecture.mdc
git commit -m "docs: document package.json plugin and theme manifests"
```

---

### Task 8: Full validation + PR polish

**Files:** none expected beyond fixes from failures

- [ ] **Step 1: Format**

Run: `npm run fmt`

- [ ] **Step 2: Lint**

Run: `npm run lint`  
Fix oxlint issues in touched files. If only pre-existing oxfmt noise remains elsewhere, still fix anything introduced by this work.

- [ ] **Step 3: Tests**

Run: `npm run test`

- [ ] **Step 4: Build**

Run: `npm run build`

- [ ] **Step 5: JSDoc check on new exports**

Run:

```bash
npx -p typescript tsc --noEmit --allowJs --checkJs --strict \
  --module preserve --moduleResolution bundler --target es2020 --jsx react-jsx \
  app/core/extensions/package-meta.js \
  app/core/themes/define.js
```

- [ ] **Step 6: Commit any fixes; push; update PR**

```bash
git add -A
git commit -m "chore: fix lint/test fallout from package.json manifests" || true
git push -u origin HEAD
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| package.json identity mapping | 1, 2, 4 |
| `bermooda.title` / `bermooda.slug` + slug regex | 1 |
| id = full package name | 1–6 |
| Auto-merge; no identity in definePlugin/defineTheme | 2, 3, 4 |
| Plugin discover glob + folder===slug | 3 |
| Slug index + URL params | 3, 6 |
| Drop adminRoutes/storefrontRoutes from package meta | 3, 6 |
| Theme `index.js` + components | 4 |
| Client-safe defineTheme (no `.server` in theme entry) | 4 |
| activeTheme / enabledPlugins store ids | 5 |
| Legacy short-id normalization | 1, 3, 5 |
| i18n via slug paths | 5 |
| Admin title display | 6 |
| Docs + architecture rules | 7 |
| Delete manifest.js | 3, 4 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-package-json-plugin-theme-manifest.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
