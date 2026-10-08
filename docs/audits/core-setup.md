# Audit: `app/core/setup/` (machine bootstrap)

Audit date: 2026-10-05. Baseline commit: `f160695` (bermooda 0.11.0).

This doc is a work queue for later sessions. Each finding has an ID, a severity, the exact location, what is wrong, the fix, and how to check it. Work through the **Work plan** at the end in order, tick the checklist, and update the `setup/` row in [code-quality-review.md](../code-quality-review.md) when everything is closed. Follow the agent rules at the top of that tracker: no follow-up placeholders, trace every caller before removing an export, and fix completely in the same change.

## Why this area

`app/core/setup/` was one of the areas the code-quality tracker didn't cover yet (the others are `bootstrap/`, `currency/`, `extensions/`, `app/emails`, `app/hooks`, `app/utils`); it was picked at random from that list. It's small (one module, ~250 lines), but it backs **unauthenticated** endpoints that can create the first admin and the first full-scope API key. Mistakes here amount to taking over the shop, so the fixes below are mainly about security and reliability, not cleanup.

## Scope and file map

| File                                                                                               | Role                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [app/core/setup/index.server.js](../../app/core/setup/index.server.js)                             | Status snapshot, SETUP_TOKEN check, first-admin + bootstrap-key creation                   |
| [app/core/setup/index.test.server.js](../../app/core/setup/index.test.server.js)                   | Unit tests (12, all passing at baseline)                                                   |
| [app/routes/api/admin/v1/setup.jsx](../../app/routes/api/admin/v1/setup.jsx)                       | `GET /api/admin/v1/setup`: public status                                                   |
| [app/routes/api/admin/v1/setup/admin.jsx](../../app/routes/api/admin/v1/setup/admin.jsx)           | `POST /api/admin/v1/setup/admin`: create first admin (no token)                            |
| [app/routes/api/admin/v1/setup/api-key.jsx](../../app/routes/api/admin/v1/setup/api-key.jsx)       | `POST /api/admin/v1/setup/api-key`: create first API key (SETUP_TOKEN)                     |
| [app/routes.js](../../app/routes.js) (`Admin setup` block)                                         | Routes registered **outside** the API-key layout, so they have no auth or audit middleware |
| [app/core/admin-onboarding/index.server.js](../../app/core/admin-onboarding/index.server.js)       | `isOnboardingAvailable`, `createFirstAdmin` (shared with the admin UI)                     |
| [app/core/api-keys/index.server.js](../../app/core/api-keys/index.server.js)                       | `createApiKey`, `listApiKeys`                                                              |
| [prisma/seed.js](../../prisma/seed.js) (`createBootstrapApiKeyIfNeeded`, admin upsert)             | CLI/seed path for the same bootstrap; reimplements key creation                            |
| [docs/api.md](../api.md), [docs/openapi.yaml](../openapi.yaml), [.env.example](../../.env.example) | Public docs for the setup endpoints                                                        |

Out of scope: the admin UI onboarding form (`app/routes/admin/index.jsx`) except where it shares `createFirstAdmin`, and better-auth internals.

## Findings

Severity: **High** = security or data-integrity risk on a real deployment · **Medium** = wrong behavior or wrong status codes in realistic cases · **Low** = cleanup, drift risk, docs.

### S1. Anyone who reaches a fresh deployment first can claim the admin account through the API (High)

- **Where:** `app/routes/api/admin/v1/setup/admin.jsx` (whole action); gate is only `isOnboardingAvailable()` in `createFirstAdmin`.
- **Problem:** `POST /api/admin/v1/setup/admin` needs no token. On a freshly deployed public shop, the first caller becomes admin. The UI form has the same exposure, but a JSON endpoint is easy to script, so anyone scanning for new shops can grab them. `SETUP_TOKEN` exists but only guards the API-key endpoint. [docs/agent-integration.md](../agent-integration.md) describes the endpoints as "guarded … via one-time setup token", which overstates what is implemented.
- **Fix:** When `SETUP_TOKEN` is configured, require `isSetupTokenAuthorized(request)` on `POST /setup/admin` too, returning the same `401 SETUP_TOKEN_REQUIRED` payload as `api-key.jsx`. Keep it open when the token is unset, so local dev and the UI flow behave as before. Document this in `.env.example`, `docs/api.md`, and the OpenAPI `security` block. Consider a production startup warning (via `#/utils/logger.server`) when onboarding is open and `SETUP_TOKEN` is unset.
- **Decide first:** whether this should be "required when configured" (recommended, non-breaking) or "always required in production". Ask the user if unsure.
- **Done when:** route test proves 401 without the token when the env var is set, 201 with it, and 201 without it when the env var is unset.

### S2. Setup endpoints share the generous `api-admin` rate-limit bucket (High)

- **Where:** `middleware` in all three setup routes (`setup.jsx:7`, `setup/admin.jsx:12`, `setup/api-key.jsx:16`).
- **Problem:** These routes are unauthenticated, yet they get 300 req/min per client, the bucket meant for authenticated API-key traffic. That allows guessing the token on `setup/api-key` and hammering bcrypt (cost 12) on `setup/admin`. Auth routes use `rateLimitMiddleware('auth')` (20/min).
- **Fix:** Switch the two POST routes to `rateLimitMiddleware('auth')`, or add a dedicated `setup` policy in `#/libs/rate-limit.server` (e.g. 10/min) and use it for all three. Update `app/routes/api/admin/v1/_layout.test.jsx`-style middleware assertions in new route tests.
- **Related (cross-cutting, note only):** the rate-limit client key trusts the raw `X-Forwarded-For` header (`app/libs/rate-limit.server.js:20`), so a client can bypass any bucket by rotating that header. Fixing that belongs to a `libs/rate-limit` pass. Record it in the tracker's "Later pass" table rather than fixing it here.

### S3. Two concurrent requests can both create a "first" API key (Medium)

- **Where:** `createBootstrapApiKeyTrusted` (`index.server.js:218-238`).
- **Problem:** Count-then-create (`listApiKeys` → `createApiKey`) isn't atomic and `ApiKey` has no uniqueness that would stop a second insert. Two concurrent token-holding requests (or API + seed racing) both get `total === 0` and both mint `admin` keys. It requires the token, so impact is limited, but "first key only" is the invariant the endpoint promises.
- **Fix:** Claim a sentinel inside a transaction. Add `SETTING_KEYS.BOOTSTRAP_API_KEY_ISSUED`, then in `prisma.$transaction` create that `Setting` row (unique `key`) and the `ApiKey`. A P2002 on the setting maps to `BOOTSTRAP_KEY_EXISTS` / 409. `createApiKey` currently uses the global client, so either accept a `tx` param or inline the create in setup using the exported key helpers (see Q1). Keep the `total > 0` pre-check for a fast 409.
- **Done when:** a unit test simulates P2002 from the sentinel insert and asserts a 409 `BOOTSTRAP_KEY_EXISTS`.

### S4. Racing first-admin creation returns 500 instead of 409 (Medium)

- **Where:** `createFirstAdmin` (`app/core/admin-onboarding/index.server.js:164` check, `:187-213` transaction); `setup/admin.jsx:28-34` rethrows unknown errors.
- **Problem:** `isOnboardingAvailable()` runs outside the transaction. The unique `Setting.key` saves integrity (the loser's `tx.setting.create` fails with Prisma `P2002`), but that error isn't mapped. The API route `throw err`s, giving a 500 with no `handleError` alert. The same applies to `User.email` P2002 if a non-admin user already holds that email.
- **Fix:** In `createFirstAdmin`, catch `P2002` and rethrow as `ONBOARDING_UNAVAILABLE` (setting target) or `VALIDATION_ERROR` with `errors.email` (user email target). This fixes the UI route too. Add tests in `app/core/admin-onboarding/index.test.server.js`.

### S5. Unexpected errors leak raw messages or skip alerting (Medium)

- **Where:** `setup/api-key.jsx:18-26,52-53` and `setup/admin.jsx:33`.
- **Problem:** `createDomainErrorMapper` maps **any** error, so a DB failure in `api-key.jsx` comes back as a `422` carrying the raw internal `err.message`, with no log and no alert. `admin.jsx` rethrows instead, so the failure isn't alerted either. CLAUDE.md requires `handleError` from `#/libs/error/index.server` in loader/action catch blocks.
- **Fix:** In both routes, map only known domain codes (`err.code` in the mapper's lists, or `err.status` set by core), and otherwise `return handleError(err, { source: 'api/admin/v1/setup/…', status: 500, userMessage: 'Setup failed' })`. Leave the shared mapper alone. Other routes catch everything the same way, so if you decide to change `createDomainErrorMapper` itself, add that to the tracker's "Later pass" table rather than widening this change.

### S6. No audit trail for setup mutations (Medium)

- **Where:** all setup POST routes. They're registered outside `routes/api/admin/v1/_layout.jsx`, so `adminApiAuditMiddleware` never runs.
- **Problem:** Creating the first admin or minting a full-scope key through an unauthenticated endpoint is exactly what an operator wants in the audit log, and today it only shows up in app logs.
- **Fix:** Call `recordAuditLog` (`#/core/audit/index.server`) from the core functions after success. Use `actorType: 'system'` (already used at `app/core/audit/index.server.js:315`), `action: 'setup.admin_created'` / `'setup.api_key_created'`, and `entityType`/`entityId` of the user or key. Log audit failures with `logger.warn` and don't fail the request, matching `audit-middleware.server.js:67`.

### S7. Public status endpoint over-shares after setup (Low)

- **Where:** `getSetupStatus` (`index.server.js:89-111`), exposed by `setup.jsx` with no auth.
- **Problem:** Exposes the exact `apiKeyCount` and `setupTokenConfigured` to anyone, forever. That's harmless during bootstrap, but it's unnecessary reconnaissance data on a live shop.
- **Fix:** Return `apiKeyCount` only while `bootstrapApiKeyAvailable` is true (or replace it with the boolean). Check the `@bermooda/cli` / MCP `setup_shop` consumers before changing the shape (the CLI lives in a separate repo, [bermooda/cli](https://github.com/bermooda/cli)). If the field must stay, document the decision here and close the item.

### S8. Token comparison leaks length and Bearer parsing is case-sensitive (Low)

- **Where:** `setupTokensMatch` (`index.server.js:46-52`), `extractSetupToken` (`:60-69`).
- **Problem:** The early `a.length !== b.length` return reveals the token length through timing. `Authorization: bearer x` (lowercase scheme, valid per RFC 9110) is ignored.
- **Fix:** Compare SHA-256 digests of both strings with `timingSafeEqual`, so the lengths are always equal. Match the scheme with `/^bearer\s+/i`. Extend the existing tests.

### Q1. Seed reimplements bootstrap-key creation (Low, drift risk)

- **Where:** `prisma/seed.js:85` `createBootstrapApiKeyIfNeeded` vs `createBootstrapApiKeyTrusted` + `createApiKey`.
- **Problem:** Seed hard-codes `'berm_'`, SHA-256 hashing, label `'bootstrap'` and scopes `['admin']` ("Mirrors app/core/api-keys" because seed cannot resolve `#/`). `createBootstrapApiKeyTrusted`'s JSDoc says "Trusted bootstrap key creation (CLI / seed)", but no CLI or seed code calls it. Its only caller is `createBootstrapApiKey`. If the key format or hash ever changes, seed-minted keys silently stop validating.
- **Fix:** Extract the pure primitives (`KEY_PREFIX`, `generateRawKey`, `hashKey`, plus `BOOTSTRAP_API_KEY_LABEL` and default scopes) into a dependency-free module with **no** `#/` imports, e.g. `app/core/api-keys/keygen.js` (only `node:crypto`). Import it from `app/core/api-keys/index.server.js`, `app/core/setup/index.server.js`, and `prisma/seed.js` (relative `../app/core/api-keys/keygen.js`; seed already imports `../app/generated/prisma/client.ts`). Then fold `createBootstrapApiKeyTrusted` into `createBootstrapApiKey` (or keep it private) and fix its JSDoc. Run `npm run seed` against a scratch SQLite DB to prove the seed still works.

### Q2. Dead and redundant code in `index.server.js` (Low)

Verified with `grep -rn` across `app/`, `prisma/`, `scripts/` at baseline:

| Item                                                                                                     | Evidence                                                                                                                                                                                                                                              | Action                                                                         |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `validateSetupAdminInput` (`:246-248`)                                                                   | No callers anywhere, including tests                                                                                                                                                                                                                  | Delete                                                                         |
| `SETUP_TOKEN_ENV` export                                                                                 | Used only inside the module                                                                                                                                                                                                                           | Make it a non-exported const                                                   |
| `mapSetupAdminError` (`:163-168`)                                                                        | Pure pass-through to `mapOnboardingActionError`, only adds `?? ''`                                                                                                                                                                                    | Delete; call `mapOnboardingActionError` from the route directly                |
| Second guard in `createBootstrapApiKey` (`:188-195`)                                                     | `!adminExists && !onboardingAvailable` is a strict subset of the next guard `!adminExists` (`:199-206`); both throw `ADMIN_REQUIRED`/422. The comment between them describes behavior that can't happen (an existing admin always closes onboarding). | Delete the first guard and the misleading comment                              |
| `createBootstrapApiKey` calls full `getSetupStatus()`                                                    | 4 queries (incl. `isOnboardingAvailable`, which itself does 2) just to read `adminExists`, then `createBootstrapApiKeyTrusted` re-runs `listApiKeys`                                                                                                  | Query only `prisma.user.count({ where: { role: 'admin' } })` + the S3 sentinel |
| Route `setup/admin.jsx` parses input twice (`parseSetupAdminInput` then `createSetupAdmin` parses again) | Minor duplication                                                                                                                                                                                                                                     | Let `createSetupAdmin` accept parsed input, or pass `fields` through           |

### Q3. Lockout state isn't reported (Low)

- **Where:** `getSetupStatus` / `createBootstrapApiKey`.
- **Problem:** If `adminSetupComplete` is set but every admin was later deleted, status reads `onboardingAvailable: false, adminExists: false`. Neither the API nor the UI can recover (by design, see `isOnboardingAvailable` JSDoc), and only `npm run cli:bootstrap` / seed can. Callers get a bare 422 `ADMIN_REQUIRED` with no hint.
- **Fix:** Use a distinct error message for this state ("Setup was completed but no admin exists; run `npm run cli:bootstrap` on the server"). Optionally add a `recoveryRequired` boolean to the status. Document it in `docs/api.md`.

### Q4. Seed admin email isn't normalized (Low, adjacent)

- **Where:** `prisma/seed.js:169-174`.
- **Problem:** `SEED_ADMIN_EMAIL=Admin@Shop.com` is stored as-is, while `createFirstAdmin` stores `normalizeEmail(email)`, so the two bootstrap paths disagree. Verify whether better-auth lowercases on sign-in before deciding severity.
- **Fix:** Normalize with `normalizeEmail` imported relatively from `../app/utils/email.js` (it has no imports, so seed can load it without `#/` aliases).

### T1. Test gaps (Medium)

Missing coverage at baseline. Add it alongside the fixes above:

- ~~**No route tests** for the three setup routes.~~ Done in PR 1. Add `app/routes/api/admin/v1/setup.test.jsx`, `setup/admin.test.jsx`, `setup/api-key.test.jsx` (no `.server` in route test names, per CLAUDE.md), covering method guard (405), token guard (401), invalid JSON (400), success (201), domain errors (409/422), unexpected errors (handleError path), and middleware composition.
- **Core:** `createBootstrapApiKey` happy path; its `BOOTSTRAP_KEY_EXISTS` path; ~~`extractSetupToken` with no headers / non-Bearer scheme / lowercase scheme~~ (done in PR 1); `getSetupStatus` with `adminSetupComplete: false`.

### D1. Docs drift (Low)

- `docs/openapi.yaml` `/setup/admin`: no `422` (validation) response. `/setup/api-key`: no `422 ADMIN_REQUIRED`, `400` validation (`LABEL_REQUIRED`, `SCOPES_INVALID`, …) responses, and no request body schema (`label`, `scopes`, `expiresAt`). `GET /setup`: no response schema.
- `docs/api.md` calls `SETUP_TOKEN` "one-shot", but nothing consumes or invalidates it. It stays valid. It's only effectively one-shot for `api-key` because of the 409. Reword this, or after S1 say it also guards `setup/admin`.
- `docs/agent-integration.md:61-63` needs updating to match whatever S1 lands.

## Work plan

Suggested PR split (Conventional Commit titles, per AGENTS.md). Each PR must pass the validation below.

1. **`fix(setup): harden unauthenticated setup endpoints`**: S1, S2, S5, S8, T1 route tests, D1. Ask the user about the S1 policy before starting.
2. **`fix(setup): make first-admin and bootstrap-key creation race-safe`**: S3, S4, S6, plus the matching core tests.
3. **`refactor(setup): share key primitives with seed and drop dead code`**: Q1, Q2, Q3, Q4, S7.

### Validation

```bash
npx vitest run app/core/setup app/core/admin-onboarding app/core/api-keys app/routes/api/admin/v1
npm run lint
# Q1/Q4 only: seed still works against a throwaway DB
DATABASE_URL="file:./prisma/scratch-setup.db" npx prisma migrate deploy && \
  DATABASE_URL="file:./prisma/scratch-setup.db" BERMOODA_MINIMAL_SEED=1 npm run seed
```

S3 adds a `SETTING_KEYS` entry only. That's a settings row, not a schema change, so no Prisma migration is needed. If you choose a schema-level constraint instead, follow the Prisma steps in CLAUDE.md.

## Status checklist

- [x] S1 setup/admin token gate (policy: required when `SETUP_TOKEN` is configured, open otherwise)
- [x] S2 dedicated rate-limit bucket (`setup`, 10/min)
- [ ] S3 race-safe bootstrap key
- [ ] S4 P2002 mapping in `createFirstAdmin`
- [x] S5 `handleError` for unexpected errors (`jsonUnexpectedError` in `#/libs/api/admin/index.server`)
- [ ] S6 audit log entries
- [ ] S7 status payload trimmed (or decision recorded)
- [x] S8 digest compare + case-insensitive Bearer
- [ ] Q1 shared key primitives, seed migrated
- [ ] Q2 dead/redundant code removed
- [ ] Q3 lockout message
- [ ] Q4 seed email normalized
- [ ] T1 route + core tests (done: route tests, `extractSetupToken`/`checkSetupToken`; open: `createBootstrapApiKey` happy/409 paths, `getSetupStatus` with no flag. Add with S3/Q2.)
- [x] D1 docs synced
- [ ] `setup/` row in [code-quality-review.md](../code-quality-review.md) marked ✅ with a summary
