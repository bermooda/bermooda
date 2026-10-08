# Audit: `app/core/extensions/` (theme/plugin package metadata and deps)

Audit date: 2026-10-08. Baseline commit: `aea9c60` (bermooda 0.11.0).

This doc is a work queue for later sessions. Findings marked **Fixed** landed with the audit PR. Work through the **Open** items in the **Work plan** order, tick the checklist, and update the `extensions/` row in [code-quality-review.md](../code-quality-review.md) when everything is closed. Follow the agent rules at the top of that tracker.

## Why this area

`extensions/` was on the list of areas the code-quality tracker didn't cover yet (with `bootstrap/`, `currency/`, `app/emails`, `app/hooks`, `app/utils`); it was picked at random. It's small (~330 lines of source), but it sits on three critical paths: every storefront route (client theme registry), server startup (theme/plugin discovery), and every build/Docker image (nested extension `npm install` + Vite `ssr.noExternal`).

## Scope and file map

| File                                                                                                         | Role                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [app/core/extensions/package-meta.js](../../app/core/extensions/package-meta.js)                             | Client-safe `package.json` identity parse/merge, `SLUG_PATTERN`, slug/folder assert |
| [app/core/extensions/engine.server.js](../../app/core/extensions/engine.server.js)                           | Shop version + `bermooda.engine` semver checks (server only)                        |
| [app/core/extensions/discovery.js](../../app/core/extensions/discovery.js)                                   | Client-safe glob module ↔ `package.json` pairing (added by this audit)              |
| [app/core/extensions/deps.server.js](../../app/core/extensions/deps.server.js)                               | Build-time scan of nested extension deps, npm install args                          |
| [app/core/themes/index.server.js](../../app/core/themes/index.server.js) (`__discoverThemesFrom`)            | Server theme discovery                                                              |
| [app/core/themes/storefront-components/index.js](../../app/core/themes/storefront-components/index.js)       | Client theme registry (bundled into every storefront route)                         |
| [app/core/plugins/registry.server.js](../../app/core/plugins/registry.server.js) (`__discoverPluginsFrom`)   | Server plugin discovery                                                             |
| [scripts/install-extension-deps.mjs](../../scripts/install-extension-deps.mjs)                               | `prebuild` / `extensions:install-deps`                                              |
| [scripts/install-default-extensions.mjs](../../scripts/install-default-extensions.mjs)                       | `extensions:install` (default theme from sibling checkout or `npm pack`)            |
| [scripts/sync-extension-tw-sources.mjs](../../scripts/sync-extension-tw-sources.mjs)                         | Tailwind scan symlinks for extension trees                                          |
| [vite.config.js](../../vite.config.js), [Dockerfile](../../Dockerfile), [.dockerignore](../../.dockerignore) | `ssr.noExternal` from extension deps; image build                                   |

Accessibility: not applicable (no UI in this area).

## Findings

Severity: **High** = security or data-integrity risk on a real deployment · **Medium** = wrong behavior, outage risk, or measurable cost in realistic cases · **Low** = cleanup, drift risk, docs.

### Fixed in the audit PR

| ID  | Severity | Category                   | Finding                                                                                                                                                                                                                                                                                                  | Fix                                                                                                                                                                                                                                          |
| --- | -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Medium   | Performance                | `package-meta.js` imported `assertEngineRange` from `engine.js`, which pulled the whole `semver` package into the client `storefront-components` chunk (26,065 B) on every storefront route, just to validate a range the browser never uses. (Root `package.json` was tree-shaken, so no version leak.) | `parseExtensionPackage` only requires a non-empty `bermooda.engine`; server discovery already runs `checkExtensionEngine` before merging. Renamed `engine.js` → `engine.server.js` so it can't reach the client again. Chunk is now 1,472 B. |
| R1  | Medium   | Reliability / consistency  | Plugin discovery threw on a malformed package (bad identity, slug/folder mismatch, invalid manifest), so one broken plugin stopped the whole shop from booting. Themes and engine-incompatible plugins already log and skip. There was no test seam for plugin discovery.                                | Added `__discoverPluginsFrom(modules, packages)` (mirrors themes), which logs `Skipping malformed plugin` and skips. Missing `package.json` and duplicate slugs still throw. New `registry.test.server.js`; documented in `docs/plugins.md`. |
| M1  | Low      | Maintainability / perf     | Three copies of the folder-from-glob-path regex and an O(n²) `Object.entries(packages).find(p => p.includes('/<kind>/<folder>/'))` lookup (themes server, storefront client, plugins).                                                                                                                   | Shared `pairExtensionModules` / `extensionFolderFromPath` in `#/core/extensions/discovery` (Map lookup), with tests. All three loops use it.                                                                                                 |
| S1  | Medium   | Security / reproducibility | `install-extension-deps` always ran `npm install`, which ignores lockfile strictness, can resolve newer (possibly compromised) versions at image build time, and rewrites the extension's lockfile.                                                                                                      | `buildExtensionInstallArgs` uses `npm ci` when the extension ships `package-lock.json`, else `npm install`. Tested; documented.                                                                                                              |
| R2  | Low      | Reliability                | `readPackageJsonFile` swallowed invalid JSON, so a broken extension's deps were silently skipped and the build failed later on an unresolved import with no hint.                                                                                                                                        | Throws `Invalid extension package.json at <path>`. Missing `package.json` is still skipped (placeholder dirs).                                                                                                                               |
| R3  | Low      | Correctness                | `runtimeDependencyNamesFromPackage` called `Object.keys` on non-object values (`"dependencies": "zod"` → `['0','1','2']` in `ssr.noExternal`).                                                                                                                                                           | Ignores non-object dependency maps; tested.                                                                                                                                                                                                  |
| M2  | Low      | Maintainability / perf     | Install script scanned the extension dirs twice (`listExtensionPackages` + `listExtensionsNeedingInstall`) and recounted deps by hand (double-counting names in both maps).                                                                                                                              | `filterExtensionsNeedingInstall(all)` + `runtimeDependencyNamesFromPackage(...).length`; dropped the script-only `installDepsForExtension` export.                                                                                           |
| A1  | Low      | Architecture               | `deps.js` and `engine.js` use `node:fs` / root `package.json` but had no `.server` suffix, against the repo rule for server-only modules.                                                                                                                                                                | Renamed to `*.server.js` (tests to `*.test.server.js`, so they run in the node project).                                                                                                                                                     |
| D1  | Medium   | Correctness (Docker)       | `.dockerignore` listed only root `node_modules`, so a contributor's host `app/{themes,plugins}/*/node_modules` (dev deps, macOS/glibc native binaries) entered the build context and could be reused by `prebuild` inside the Alpine image.                                                              | Added `**/node_modules`; `prebuild` reinstalls nested deps for the image platform.                                                                                                                                                           |

Verified non-issue: transitive deps of extension-only packages are inlined by the SSR build (checked with a fixture: `foo` in `ssr.noExternal` importing nested `bar` bundles both and runs from `build/`).

### Open

#### O1. Final Docker image ships nested extension `node_modules` it doesn't need (Medium, scalability) — **Fixed**

- **Where:** `Dockerfile`, final stage `COPY --from=build-env /app/app/themes …` and `/app/app/plugins …`.
- **Problem:** `prebuild` installs extension deps into `app/{themes,plugins}/<slug>/node_modules`, and the final stage copies those trees wholesale. The Dockerfile comment and `docs/plugins.md` both say runtime doesn't need them (SSR inlines them; native addons must be shop-root deps), so they only add image size and attack surface.
- **Fix:** `build-env` runs `RUN rm -rf app/themes/*/node_modules app/plugins/*/node_modules` right after `RUN npm run build`. `docs/plugins.md` says so.
- **Verified in a real image:** `docker build` with a fixture theme in `app/themes/` whose deps are `p-limit` (imports `yocto-queue`) and `clsx@1` (the shop root has `clsx@2`). Prebuild ran `npm ci --prefix app/themes/extension-smoke` and the build succeeded. `docker run` with a migrated SQLite DB and `activeTheme` set to the fixture served `GET /` with 200, rendering the fixture's `extension-smoke concurrency-1`, so the bundled deps ran. `ls -d app/themes/*/node_modules` in the container found nothing.

#### O2. Extension dependency lifecycle scripts run at build time (Medium, security) — **Fixed**

- **Where:** `buildExtensionInstallArgs` in `deps.server.js` (no `--ignore-scripts`).
- **Problem:** Every `prebuild` (CI, Docker) executes `preinstall`/`postinstall` scripts of each third-party theme/plugin's dependency tree with full build-environment access (env vars, registry tokens). `npm ci` (S1) narrows which versions run but not whether scripts run.
- **Decision (maintainer):** `--ignore-scripts` by default, with an operator-only opt-in through an env var. A `bermooda.allowInstallScripts` flag in the extension's own `package.json` was rejected: the extension author is the party being guarded against, so they could just set it.
- **Fix:** `buildExtensionInstallArgs` appends `--ignore-scripts` unless `extensionInstallScriptsAllowed(ext, process.env.BERMOODA_EXTENSION_INSTALL_SCRIPTS)` holds. `1` / `true` / `all` allow every extension; a comma list of `<kind>/<slug>` (`plugins/resend,themes/default`) allows only those. Anything else, including a bare slug, keeps scripts off. `install-extension-deps` logs `lifecycle scripts allowed` for opted-in extensions. The Dockerfile `build-env` stage declares the env var as an `ARG` (default empty) so `docker build --build-arg …` can opt in. Unit tests cover the parser, the default, the env read, and the explicit option. `docs/plugins.md` and `docs/themes.md` describe the policy.
- **Verified:** a temp plugin whose dependency's `postinstall` writes a marker file installs without writing it by default, and writes it with `BERMOODA_EXTENSION_INSTALL_SCRIPTS=plugins/<slug>`.
- **Not covered:** the bermooda CLI (`theme add` / `plugin add`) lives in a separate repo and runs its own install. It should pass `--ignore-scripts` under the same env var.

#### O3. `extensions:install` fallback packs an unpinned default theme (Low, reliability/supply chain)

- **Where:** `installFromNpm` in `scripts/install-default-extensions.mjs` (`npm pack @bermooda/theme-default`).
- **Problem:** It always takes `latest`. If a newer theme requires a newer `bermooda.engine`, server discovery soft-skips it and a fresh `npm run setup` ends with no usable storefront theme and only a log line.
- **Fix:** After extracting, read the theme's `package.json` and check `bermooda.engine` against the root version with `semver.satisfies`. Fail with a clear message, or pack the newest compatible version via `npm view @bermooda/theme-default versions --json` + `semver.maxSatisfying`. The script can't import `engine.server.js` directly (it imports JSON without import attributes), so use `semver` + `JSON.parse(readFileSync('package.json'))` in the script.

#### O4. CI never exercises the extension build path (Medium, automation/testing) — **Fixed**

- **Where:** `.github/workflows/ci.yml` `build` job. CI has no installed themes/plugins, so `install-extension-deps` logs "nothing to install" and `ssr.noExternal` is empty.
- **Fix:** The fixture theme `scripts/fixtures/extension-smoke/` has a lockfile and two exact-pinned deps:
  - `p-limit`, which imports `yocto-queue`. Neither is a shop-root dependency.
  - `clsx@1`, which shadows the shop root's `clsx@2`.

  The CI `build` job's "Extension smoke build" step copies the fixture to `app/themes/extension-smoke/`, runs `npm run build` (prebuild runs `npm ci --ignore-scripts` for it), and deletes the nested `node_modules` as the Docker image does. It then runs `scripts/check-extension-smoke-build.mjs`, which asserts:
  - `build/server/index.js` has no external `import` of any of the three deps;
  - importing `build/server/index.js` exits 0 without `ERR_MODULE_NOT_FOUND`, and server discovery logs `Theme registered` for the fixture;
  - no `storefront-components-*.js` client chunk contains `SEMVER_SPEC_VERSION` (guards P1).

- **Why `clsx`:** Vite only externalizes a bare import it can resolve from the shop root, so extension-only deps like `p-limit` get inlined even without `ssr.noExternal`. The setting only matters when the root also has the package, often at another version, as with `clsx`. Without the `clsx` dep the smoke would still pass after `ssr.noExternal` was removed.
- **Verified failure modes:** each regression was injected locally and the check failed with a specific message:
  - `ssr.noExternal: []`: "imports "clsx" as an external".
  - `p-limit` forced into `ssr.external`: the external-import failure plus the import's `ERR_MODULE_NOT_FOUND`.
  - `semver` re-imported into the client registry: "bundles semver".

#### O5. Client registry eagerly bundles every installed theme (Low now, scales badly)

- **Where:** `app/core/themes/storefront-components/index.js` (`import.meta.glob('#/themes/*/index.js', { eager: true })`).
- **Problem:** Every installed theme's components ship to every shopper, active or not. Harmless with one theme, but the cost grows linearly with installed themes (marketplace previews, theme switching). The client registry also doesn't check `bermooda.engine`, so it can hold themes the server skipped (lookups use the server's `themeId`, so this is only dead weight).
- **Fix:** Belongs to a `core/themes` pass: lazy-load (`eager: false`) per theme and resolve the active theme's module in the route `clientLoader`/lazy component, or build-time filter to the active theme. Measure client bundle before/after with two themes installed.

#### O6. Tailwind source sync duplicates the extension dir scan (Low, maintainability)

- **Where:** `listExtensionSlugs` in `scripts/sync-extension-tw-sources.mjs` hardcodes `'themes'`/`'plugins'` and its own `readdirSync` filter.
- **Fix:** Loop over `EXTENSION_KIND_DIRS` from `deps.server.js` (keep including folders without `package.json` if Tailwind needs them; otherwise reuse `listExtensionPackages`). Add a test for the symlink sync with a temp dir.

## Work plan

1. [x] O1: Docker final-stage cleanup (verified with `docker build` + `docker run`).
2. [x] O2: decide on install-script policy with the maintainer, then implement (`--ignore-scripts` + `BERMOODA_EXTENSION_INSTALL_SCRIPTS` opt-in).
3. [x] O4: fixture extension + CI smoke build (also guards P1, O1's "no nested node_modules at runtime", and `ssr.noExternal`).
4. [ ] O3: engine-aware default theme fallback.
5. [ ] O6: reuse `EXTENSION_KIND_DIRS` in the Tailwind sync.
6. [ ] O5: move to a `core/themes` performance pass (record in the tracker's later-pass table if not done here).
7. [ ] Mark `extensions/` ✅ in [code-quality-review.md](../code-quality-review.md).
