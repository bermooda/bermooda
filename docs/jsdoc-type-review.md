# JSDoc type review tracker

Incremental passes over the codebase to improve JSDoc annotations and fix TypeScript `checkJs` issues. The project uses [jsconfig.json](../jsconfig.json) (`allowJs` + `checkJs`) for editor type checking — not full `strict` mode, so many issues only surface when checking files with stricter flags.

Mark an area **done** only when its production modules pass the area check command below and obvious `@ts-ignore` / implicit-`any` gaps in that area are resolved.

## Status legend

- ⬜ Pending
- ✅ Done (reviewed; typing fixes applied)

## How to check an area

From the repo root:

```bash
# Project-wide (lenient — matches jsconfig.json)
npx -p typescript tsc -p jsconfig.json --noEmit

# Stricter per-area pass (recommended for reviews)
npx -p typescript tsc --noEmit --allowJs --checkJs --strict \
  --module preserve --moduleResolution bundler --target es2020 --jsx react-jsx \
  "app/utils/*.js"
```

Skip `*.test.*` files in area checks unless you add `paths` for `#/*` (tests import via alias). Focus on production modules first.

### Common fixes

| Issue                                     | Fix                                            |
| ----------------------------------------- | ---------------------------------------------- |
| Implicit `any` on params                  | Add `@param {Type}` JSDoc                      |
| `string \| undefined` vs `string \| null` | Normalize return (`?? null`) or fix `@returns` |
| `cache.get()` returns `unknown`           | Cast with `/** @type {T} */ (...)` or narrow   |
| `any` in generics                         | Use `@template T` and `Promise<T>`             |
| Missing exports on cookie/header helpers  | Document `Request`, `Headers`, return types    |
| Stale file-extension comments             | Update `.ts` references to `.js`               |

## Agent rules

1. Pick **one area** per session (or finish a started area).
2. Run the strict area check; fix production files in that area.
3. Run targeted tests when the area has `*.test.*` siblings.
4. Update this doc: mark the area ✅ with a short notes column entry.
5. Do not enable `strict: true` in `jsconfig.json` globally until most areas are done.
6. Follow [.cursor/rules/jsdoc-types.mdc](../.cursor/rules/jsdoc-types.mdc) when generating or editing code — JSDoc is required on new/changed exports, not only during dedicated type-review passes.

---

## Shared utilities (`app/utils/`)

| Module             | Status | Notes                                                                                                                                     |
| ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `app/utils/` (all) | ✅     | Added JSDoc on cart/checkout cookie helpers; fixed `getCookieValue` nullability; generic `getCachedResult<T>`; typed cache key iteration. |

---

## Hooks (`app/hooks/`)

| Module       | Status | Notes                                                                                                                                                       |
| ------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/hooks/` | ✅     | Added `@types/react`; fixed optional `ActionResponse`; typed keyboard/media-query handlers; fixed `createContext` null cast; `CommandPaletteState` typedef. |

---

## UI components (`app/components/`)

| Area                                  | Status | Notes |
| ------------------------------------- | ------ | ----- |
| `admin/`                              | ⬜     |       |
| `admin/form/`                         | ⬜     |       |
| `auth/`                               | ⬜     |       |
| `seo/`                                | ⬜     |       |
| `ui/`                                 | ⬜     |       |
| Root components (`slot-blocks`, etc.) | ⬜     |       |

---

## Core domain (`app/core/`)

| Area                                                 | Status | Notes |
| ---------------------------------------------------- | ------ | ----- |
| `address-validation/`                                | ⬜     |       |
| `admin/`                                             | ⬜     |       |
| `admin-onboarding/`                                  | ⬜     |       |
| `api-keys/`                                          | ⬜     |       |
| `audit/`                                             | ⬜     |       |
| `b2b/`                                               | ⬜     |       |
| `back-in-stock/`                                     | ⬜     |       |
| `cart/`                                              | ⬜     |       |
| `catalog/`                                           | ⬜     |       |
| `channels/`                                          | ⬜     |       |
| `checkout/`                                          | ⬜     |       |
| `collections/`                                       | ⬜     |       |
| `content/`                                           | ⬜     |       |
| `currency/`                                          | ⬜     |       |
| `customers/`                                         | ⬜     |       |
| `discounts/`                                         | ⬜     |       |
| `documents/`                                         | ⬜     |       |
| `events/`                                            | ⬜     |       |
| `exports/`                                           | ⬜     |       |
| `gdpr/`                                              | ⬜     |       |
| `gift-cards/`                                        | ⬜     |       |
| `i18n/`                                              | ⬜     |       |
| `imports/`                                           | ⬜     |       |
| `inventory/`                                         | ⬜     |       |
| `loyalty/`                                           | ⬜     |       |
| `marketing/`                                         | ⬜     |       |
| `orders/`                                            | ⬜     |       |
| `payments/`                                          | ⬜     |       |
| `plugins/`                                           | ⬜     |       |
| `pos/`                                               | ⬜     |       |
| `pricing/`                                           | ⬜     |       |
| `rbac/`                                              | ⬜     |       |
| `reporting/`                                         | ⬜     |       |
| `returns/`                                           | ⬜     |       |
| `reviews/`                                           | ⬜     |       |
| `search/`                                            | ⬜     |       |
| `seo/`                                               | ⬜     |       |
| `settings/`                                          | ⬜     |       |
| `shipping/`                                          | ⬜     |       |
| `storage/`                                           | ⬜     |       |
| `store-credit/`                                      | ⬜     |       |
| `subscriptions/`                                     | ⬜     |       |
| `tax/`                                               | ⬜     |       |
| `themes/`                                            | ⬜     |       |
| `webhooks/`                                          | ⬜     |       |
| `wishlists/`                                         | ⬜     |       |
| Root (`bootstrap.server.js`, `index.test.jsx`, etc.) | ⬜     |       |

---

## Infrastructure (`app/libs/`)

| Area                                                   | Status | Notes |
| ------------------------------------------------------ | ------ | ----- |
| `alerting/`                                            | ⬜     |       |
| `api/`                                                 | ⬜     |       |
| `auth/`                                                | ⬜     |       |
| `prisma/`                                              | ⬜     |       |
| `queue/`                                               | ⬜     |       |
| Root (`error.server.js`, `rate-limit.server.js`, etc.) | ⬜     |       |

---

## Routes (`app/routes/`)

| Area                                 | Status | Notes |
| ------------------------------------ | ------ | ----- |
| `storefront/`                        | ⬜     |       |
| `admin/`                             | ⬜     |       |
| `api/v1/`                            | ⬜     |       |
| `api/admin/v1/`                      | ⬜     |       |
| `webhooks/`                          | ⬜     |       |
| `auth/`                              | ⬜     |       |
| Root (`404.jsx`, `health.jsx`, etc.) | ⬜     |       |

---

## Emails (`app/emails/`)

| Area                                       | Status | Notes |
| ------------------------------------------ | ------ | ----- |
| `components/`                              | ⬜     |       |
| `shop/`                                    | ⬜     |       |
| `templates/`                               | ⬜     |       |
| Root (`index.server.jsx`, `job.server.js`) | ⬜     |       |

---

## Themes (`app/themes/`)

| Area                           | Status | Notes |
| ------------------------------ | ------ | ----- |
| `default/components/`          | ⬜     |       |
| `default/i18n/`                | ⬜     |       |
| `default/` manifest & registry | ⬜     |       |

---

## Plugins (`app/plugins/`)

| Area                | Status | Notes |
| ------------------- | ------ | ----- |
| `fraud-guard/`      | ⬜     |       |
| `meilisearch/`      | ⬜     |       |
| `sample-analytics/` | ⬜     |       |

---

## App shell & entry

| Area                                        | Status | Notes                          |
| ------------------------------------------- | ------ | ------------------------------ |
| `app/root.jsx`                              | ⬜     | Has `// @ts-ignore` on line 15 |
| `app/routes.js`                             | ⬜     |                                |
| `app/entry.client.jsx` / `entry.server.jsx` | ⬜     |                                |

---

## Test support (`app/test/`)

| Area         | Status | Notes                                            |
| ------------ | ------ | ------------------------------------------------ |
| `factories/` | ⬜     | Lower priority — not in storefront/admin runtime |
| `helpers/`   | ⬜     |                                                  |
