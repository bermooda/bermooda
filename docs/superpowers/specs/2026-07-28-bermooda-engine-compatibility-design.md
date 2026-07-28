# Design: Plugin/theme `bermooda.engine` compatibility

**Date:** 2026-07-28  
**Status:** Approved  
**Repos:** bermooda (app) + bermooda-cli

## Goal

Plugins and themes declare which bermooda system versions they support via a required `bermooda.engine` semver range in `package.json`. The CLI enforces this on install/update; the app soft-skips incompatible extensions at discovery.

## Decisions

| Decision | Choice |
| -------- | ------ |
| Field | `bermooda.engine` (string semver range, e.g. `">=1.0.0"`) |
| Required? | Yes — missing or invalid engine is incompatible |
| Range library | `semver` (full npm ranges) |
| Shop version source | Root app `package.json` `"version"` (add `"1.0.0"`) |
| CLI on mismatch | Hard fail before copying files |
| Runtime on mismatch | Soft skip — log and do not register; continue |
| Registry `minBermoodaVersion` | Unused; package.json is sole source of truth |
| Force override | Not in v1 |

## Schema

### Shop root `package.json`

```json
{
  "name": "bermooda",
  "version": "1.0.0",
  "private": true
}
```

This `version` is the bermooda **engine version** used for compatibility checks (`bermooda version --shop` already reads it).

### Plugin / theme `package.json`

```json
{
  "name": "@bermooda/my-plugin",
  "version": "1.0.0",
  "bermooda": {
    "title": "My Plugin",
    "slug": "my-plugin",
    "engine": ">=1.0.0"
  }
}
```

| Field | Required | Meaning |
| ----- | -------- | ------- |
| `bermooda.engine` | yes | Semver range of compatible bermooda app versions |

Compatibility rule:

```js
semver.satisfies(shopVersion, engineRange)
```

Bundled first-party plugins and themes all set `"engine": ">=1.0.0"`.

## CLI behavior

Applies to `bermooda plugin add|update` and `bermooda theme add|update` (shared `installExtension` pipeline), for all sources (npm, path, git, tarball, registry fallback).

**Before** copying into `app/plugins/<id>` or `app/themes/<id>`:

1. Read shop root `package.json` `version`. Fail if missing or not a valid semver version.
2. Read extension `bermooda.engine`. Fail if missing or not a valid semver range.
3. If `!semver.satisfies(shopVersion, engine)`, exit with a user error, e.g.  
   `Plugin "fraud-guard" requires bermooda >=2.0.0 (shop is 1.0.0)`.

Implementation sketch:

- New helper, e.g. `assertEngineCompatible({ shopVersion, engine, kind, id })` in CLI `src/lib/`.
- Call from `installExtension` (or immediately before `installFromPath`) so every install path is covered.
- Add `semver` dependency to `@bermooda/cli`.

## App runtime behavior

During plugin/theme discovery (package meta parse + registration):

1. Extend `parseExtensionPackage` (or adjacent helper) to require `bermooda.engine` and validate it as a semver range.
2. Compare against the app root `package.json` `version`.
3. On missing / invalid / unsatisfied engine: **soft-skip** — log a clear error via `#/utils/logger.server`, do not register that extension, continue discovering others.

Add `semver` to the app dependencies (thin wrapper under `#/core/extensions/` is fine).

## Docs

Update:

- `docs/plugins.md` — required `bermooda.engine` in package.json contract
- `docs/themes.md` — same
- CLI `DESIGN.md` / README — install-time engine check

## Testing

**CLI**

- Unit tests for the engine helper: satisfies, missing, invalid range, mismatch.
- Install path rejects incompatible packages before filesystem copy.

**App**

- Package-meta / discovery tests: required engine, soft-skip on mismatch, register when satisfied.

## Non-goals

- Enforcing registry `minBermoodaVersion`
- `--force` / bypass flags
- Checking CLI package version against extensions (only shop app version)
- Blocking app boot when one extension is incompatible (soft-skip only)
