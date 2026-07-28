# Bermooda Engine Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require `bermooda.engine` on plugins/themes; CLI hard-fails on install mismatch; app soft-skips incompatible extensions at discovery.

**Architecture:** Shared semver check against the shop root `package.json` `version`. App helper `#/core/extensions/engine.js` (+ discovery soft-skip). CLI helper `src/lib/engine.js` wired into `installExtension` before copy. Field lives under `package.json` → `bermooda.engine`.

**Tech Stack:** JavaScript (ESM), `semver`, Vitest, oxlint/oxfmt.

**Spec:** `docs/superpowers/specs/2026-07-28-bermooda-engine-compatibility-design.md`

**Repos:** bermooda (app) + bermooda-cli (`/Users/cvgellhorn/dev/bermooda/cli`)

---

## File map

### App (`bermooda`)

| File                                                             | Responsibility                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| `package.json`                                                   | Add `"version": "1.0.0"` + `semver` dependency                   |
| `app/core/extensions/engine.js`                                  | `getAppVersion()`, `isEngineCompatible()`, `assertEngineRange()` |
| `app/core/extensions/engine.test.js`                             | Unit tests for engine helpers                                    |
| `app/core/extensions/package-meta.js`                            | Require + validate `bermooda.engine`; include in meta typedef    |
| `app/core/extensions/package-meta.test.js`                       | Update fixtures + engine tests                                   |
| `app/core/plugins/index.server.js`                               | Soft-skip in `discoverPlugins` on engine failure                 |
| `app/core/bootstrap/index.server.js`                             | Soft-skip default theme register if incompatible (log)           |
| `app/plugins/*/package.json` + `app/themes/default/package.json` | Add `"engine": ">=1.0.0"`                                        |
| `docs/plugins.md`, `docs/themes.md`                              | Document required field                                          |

### CLI (`bermooda-cli`)

| File                                        | Responsibility                                              |
| ------------------------------------------- | ----------------------------------------------------------- |
| `package.json`                              | Add `semver` dependency                                     |
| `src/lib/engine.js`                         | `assertEngineCompatible({ shopVersion, engine, kind, id })` |
| `src/lib/extension-source.js`               | Call assert before `installFromPath`                        |
| `test/engine.test.js`                       | Unit tests                                                  |
| `test/npm-pack.test.js` or new install test | Install rejects incompatible package                        |
| `DESIGN.md` / `README.md`                   | Document check                                              |
| `test/helpers.js`                           | Fixture packages include `bermooda.engine`                  |

---

### Task 1: App — version + engine helper (TDD)

**Repo:** `/Users/cvgellhorn/dev/bermooda/bermooda`  
**Branch:** `feat/bermooda-engine-compatibility` (create from current HEAD if needed)

**Files:**

- Create: `app/core/extensions/engine.js`
- Create: `app/core/extensions/engine.test.js`
- Modify: `package.json` (add `"version": "1.0.0"`, add `semver` dep)

- [ ] **Step 1: Add version + install semver**

In root `package.json`, add `"version": "1.0.0"` next to `"name": "bermooda"`, then:

```bash
npm install semver --legacy-peer-deps
```

- [ ] **Step 2: Write failing tests** in `app/core/extensions/engine.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  assertEngineRange,
  isEngineCompatible,
  getAppVersion,
} from '#/core/extensions/engine';

describe('assertEngineRange', () => {
  it('returns trimmed range when valid', () => {
    expect(assertEngineRange('>=1.0.0')).toBe('>=1.0.0');
  });
  it('throws when missing or invalid', () => {
    expect(() => assertEngineRange(undefined)).toThrow(/engine/);
    expect(() => assertEngineRange('not-a-range')).toThrow(/engine/);
  });
});

describe('isEngineCompatible', () => {
  it('returns true when shop satisfies range', () => {
    expect(isEngineCompatible('1.0.0', '>=1.0.0')).toBe(true);
  });
  it('returns false when shop does not satisfy range', () => {
    expect(isEngineCompatible('1.0.0', '>=2.0.0')).toBe(false);
  });
});

describe('getAppVersion', () => {
  it('returns a valid semver from root package.json', () => {
    expect(getAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
npm run test -- app/core/extensions/engine.test.js
```

- [ ] **Step 4: Implement** `app/core/extensions/engine.js`:

```js
import semver from 'semver';
import appPackage from '../../../package.json';

/**
 * @returns {string}
 */
export function getAppVersion() {
  const version = appPackage?.version;
  if (typeof version !== 'string' || !semver.valid(version)) {
    throw new Error(
      'bermooda root package.json must declare a valid semver "version"'
    );
  }
  return version;
}

/**
 * @param {unknown} engine
 * @returns {string}
 */
export function assertEngineRange(engine) {
  if (typeof engine !== 'string' || engine.trim() === '') {
    throw new Error(
      'Extension package missing required field: "bermooda.engine"'
    );
  }
  const range = engine.trim();
  if (!semver.validRange(range)) {
    throw new Error(
      `Extension package bermooda.engine is not a valid semver range: "${range}"`
    );
  }
  return range;
}

/**
 * @param {string} shopVersion
 * @param {string} engineRange
 * @returns {boolean}
 */
export function isEngineCompatible(shopVersion, engineRange) {
  return semver.satisfies(shopVersion, engineRange);
}

/**
 * @param {object} opts
 * @param {string} opts.shopVersion
 * @param {unknown} opts.engine
 * @param {'plugin'|'theme'} opts.kind
 * @param {string} [opts.id]
 * @returns {{ ok: true, engine: string } | { ok: false, reason: string }}
 */
export function checkExtensionEngine({ shopVersion, engine, kind, id }) {
  try {
    const range = assertEngineRange(engine);
    if (!isEngineCompatible(shopVersion, range)) {
      const label = id ? `${kind} "${id}"` : kind;
      return {
        ok: false,
        reason: `${label} requires bermooda ${range} (shop is ${shopVersion})`,
      };
    }
    return { ok: true, engine: range };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
```

Ensure Vite/JS can import JSON (already used elsewhere). Add JSDoc. If `import appPackage from '../../../package.json'` fails resolution, use `createRequire` or `readFileSync` relative to `import.meta.url` walking up to root `package.json` with `"name":"bermooda"`.

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app/core/extensions/engine.js app/core/extensions/engine.test.js
git commit -m "$(cat <<'EOF'
feat: add bermooda engine version helper

Root package version plus semver checks for extension compatibility.
EOF
)"
```

---

### Task 2: App — package-meta requires engine + soft-skip discovery

**Repo:** bermooda  
**Depends on:** Task 1

**Files:**

- Modify: `app/core/extensions/package-meta.js`
- Modify: `app/core/extensions/package-meta.test.js`
- Modify: `app/core/plugins/index.server.js` (`discoverPlugins`)
- Modify: `app/core/bootstrap/index.server.js` (theme register)
- Modify: all `app/plugins/*/package.json` + `app/themes/default/package.json`
- Update any test fixtures that call `parseExtensionPackage` without engine

- [ ] **Step 1: Update tests** — extend `validPkg` with `engine: '>=1.0.0'`; expect `engine` on parsed meta; add throw when engine missing; add `checkExtensionEngine` soft-skip behavior tests if covering discover separately.

- [ ] **Step 2: Update `parseExtensionPackage`** to require `bermooda.engine` via `assertEngineRange`, add `engine` to `ExtensionPackageMeta` typedef and returned meta.

- [ ] **Step 3: Soft-skip in `discoverPlugins`**

```js
import { checkExtensionEngine, getAppVersion } from '#/core/extensions/engine';
import logger from '#/utils/logger.server'; // use whatever logger path the file already uses

// inside loop, after reading pkg:
const shopVersion = getAppVersion();
const engineCheck = checkExtensionEngine({
  shopVersion,
  engine: pkg?.bermooda?.engine,
  kind: 'plugin',
  id: typeof pkg?.name === 'string' ? pkg.name : folder,
});
if (!engineCheck.ok) {
  logger.error({ folder, reason: engineCheck.reason }, 'Skipping incompatible plugin');
  continue;
}
// then mergeExtensionPackage + register as today
```

Follow existing logger import style in that file.

- [ ] **Step 4: Soft-skip default theme in bootstrap**

Before `registerTheme(mergeExtensionPackage(...))`, run `checkExtensionEngine` for the default theme package; on failure `logger.error` and skip register (do not throw).

- [ ] **Step 5: Add `"engine": ">=1.0.0"`** to every bundled plugin/theme `package.json` under `bermooda`.

- [ ] **Step 6: Fix broken tests** (`package-meta.test.js`, bootstrap mocks, plugin tests importing package.json). Run:

```bash
npm run test -- app/core/extensions app/core/plugins app/core/bootstrap
```

- [ ] **Step 7: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: require bermooda.engine and soft-skip incompatible extensions

Parse engine from package.json; skip plugins/themes that do not match the app version.
EOF
)"
```

---

### Task 3: App — docs

**Repo:** bermooda

- [ ] Update `docs/plugins.md` and `docs/themes.md` field tables + examples to include required `bermooda.engine` (semver range, e.g. `>=1.0.0`).
- [ ] Commit: `docs: document required bermooda.engine for plugins and themes`

---

### Task 4: CLI — engine helper + install gate (TDD)

**Repo:** `/Users/cvgellhorn/dev/bermooda/cli`  
**Branch:** `feat/bermooda-engine-compatibility`

**Files:**

- Create: `src/lib/engine.js`
- Create: `test/engine.test.js`
- Modify: `package.json` (add `semver`)
- Modify: `src/lib/extension-source.js`
- Modify: `test/helpers.js` fixtures
- Modify/add install tests

- [ ] **Step 1:** `npm install semver`

- [ ] **Step 2: Failing tests** for `assertEngineCompatible` — succeeds when compatible; `process.exit` or throws/errors path when missing/invalid/mismatch. Match CLI error style (`error()` + `process.exit(EXIT.USER)`). Prefer pure function that returns `{ ok, message }` and let caller exit — easier to test:

```js
/**
 * @param {{ shopVersion: string|null|undefined, engine: unknown, kind: 'plugin'|'theme', id: string }} opts
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function evaluateEngineCompatibility(opts) {
  /* ... */
}

export function assertEngineCompatible(opts) {
  const result = evaluateEngineCompatibility(opts);
  if (!result.ok) {
    error(result.message);
    process.exit(EXIT.USER);
  }
}
```

Message format: `Plugin "fraud-guard" requires bermooda >=2.0.0 (shop is 1.0.0)`

Also fail when shop version missing/invalid: `Shop package.json must declare a valid semver "version"`.

- [ ] **Step 3: Implement** `src/lib/engine.js` using `semver`.

- [ ] **Step 4: Wire into `installExtension`** before `installFromPath`:

```js
import { assertEngineCompatible } from './engine.js';
import { readPackageJson } from './package-json.js';

// inside installExtension try block, before installFromPath:
const shopPkg = readPackageJson(shopRoot);
const extPkg = readPackageJson(sourceDir);
assertEngineCompatible({
  shopVersion: shopPkg?.version,
  engine: extPkg?.bermooda?.engine,
  kind,
  id,
});
```

- [ ] **Step 5: Update fixtures** in `test/helpers.js` so created plugins/themes include `bermooda.engine: '>=0.0.0'` (or `>=1.0.0`) and shop fixture `package.json` includes `"version": "1.0.0"`.

- [ ] **Step 6: Add test** that install fails when engine is `>=99.0.0`.

- [ ] **Step 7: Run `npm test` — all pass.

- [ ] **Step 8: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: enforce bermooda.engine on plugin and theme install

Reject installs when the shop version does not satisfy the extension engine range.
EOF
)"
```

---

### Task 5: CLI — docs

- [ ] Update `DESIGN.md` install steps + `README.md` to mention required `bermooda.engine` and install-time check.
- [ ] Commit: `docs: document bermooda.engine install check`

---

### Task 6: Preflight + PRs

**App**

- [ ] `npm run lint` (fmt if needed), `npm run build`, targeted tests
- [ ] Push branch, `gh pr create` against `master`/`main`

**CLI**

- [ ] `npm run lint` (fmt if needed), `npm test`
- [ ] Push branch, `gh pr create`

PR bodies should summarize: required `bermooda.engine`, root version, CLI hard-fail, app soft-skip; include test plan checklist.

---

## Spec coverage checklist

| Spec requirement                   | Task                    |
| ---------------------------------- | ----------------------- |
| Root `version: 1.0.0`              | 1                       |
| `bermooda.engine` required         | 2, 4                    |
| semver ranges                      | 1, 4                    |
| CLI hard-fail before copy          | 4                       |
| Runtime soft-skip                  | 2                       |
| Bundled packages get engine        | 2                       |
| Docs                               | 3, 5                    |
| Registry minBermoodaVersion unused | (no task — intentional) |
| No --force                         | (no task — intentional) |
