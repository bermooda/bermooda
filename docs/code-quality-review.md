# Code quality review tracker

Incremental quality passes over the codebase. Each area gets a review of implementation quality, reusability, and unnecessary complexity. Mark areas **done** after review (and any applied fixes).

## Agent rules (required)

Finish each review completely in the same PR — do not defer work.

1. **No follow-up placeholders** — Do not add notes like "follow-up", "later pass", or "consider doing X". If you identify a duplicate helper, dead export, or unused path, fix it in the same change.
2. **Trace all usages** — Before extracting or removing a function, grep the repo for callers. Migrate every caller to the shared helper, or delete the dead code.
3. **Remove, don't preserve** — Do not keep legacy functions "just in case" or "for API stability" when nothing in routes, core, themes, or tests uses them. Delete the code and its tests.
4. **Shared helpers belong in one place** — When the same logic appears in core, themes, emails, or payments, move it to the appropriate shared module (e.g. `#/core/cart/lines`) and update all call sites immediately.
5. **Mark done only when complete** — An area is ✅ only when the refactor is fully applied across the codebase, tests are updated, and no related cleanup items remain open.

## Status legend

- ⬜ Pending
- ✅ Done (reviewed; all improvements applied in the same pass)

## Core domain (`app/core/`)

| Area                  | Status | Notes                                                                                                                                                            |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discounts/`          | ✅     | Lifecycle validation deduped; `summarizeCartLines` moved to `#/core/cart/lines`; removed unused `applyDiscount`, cart-discount CRUD, and CartDiscount read path. |
| `cart/`               | ✅     | `summarizeCartLines` + `cartLineTotal` in `#/core/cart/lines`; all core/themes/emails/payments callers migrated; cart service helpers deduped.                   |
| `checkout/`           | ⬜     |                                                                                                                                                                  |
| `orders/`             | ⬜     |                                                                                                                                                                  |
| `catalog/`            | ⬜     |                                                                                                                                                                  |
| `payments/`           | ⬜     |                                                                                                                                                                  |
| `shipping/`           | ⬜     |                                                                                                                                                                  |
| `tax/`                | ⬜     |                                                                                                                                                                  |
| `pricing/`            | ⬜     |                                                                                                                                                                  |
| `customers/`          | ⬜     |                                                                                                                                                                  |
| `inventory/`          | ⬜     |                                                                                                                                                                  |
| `gift-cards/`         | ⬜     |                                                                                                                                                                  |
| `loyalty/`            | ⬜     |                                                                                                                                                                  |
| `store-credit/`       | ⬜     |                                                                                                                                                                  |
| `collections/`        | ⬜     |                                                                                                                                                                  |
| `search/`             | ⬜     |                                                                                                                                                                  |
| `i18n/`               | ⬜     |                                                                                                                                                                  |
| `themes/`             | ⬜     |                                                                                                                                                                  |
| `plugins/`            | ⬜     |                                                                                                                                                                  |
| `webhooks/`           | ⬜     |                                                                                                                                                                  |
| `events/`             | ⬜     |                                                                                                                                                                  |
| `settings/`           | ⬜     |                                                                                                                                                                  |
| `rbac/`               | ⬜     |                                                                                                                                                                  |
| `audit/`              | ⬜     |                                                                                                                                                                  |
| `exports/`            | ⬜     |                                                                                                                                                                  |
| `imports/`            | ⬜     |                                                                                                                                                                  |
| `gdpr/`               | ⬜     |                                                                                                                                                                  |
| `marketing/`          | ⬜     |                                                                                                                                                                  |
| `reporting/`          | ⬜     |                                                                                                                                                                  |
| `returns/`            | ⬜     |                                                                                                                                                                  |
| `reviews/`            | ⬜     |                                                                                                                                                                  |
| `seo/`                | ⬜     |                                                                                                                                                                  |
| `content/`            | ⬜     |                                                                                                                                                                  |
| `channels/`           | ⬜     |                                                                                                                                                                  |
| `b2b/`                | ⬜     |                                                                                                                                                                  |
| `subscriptions/`      | ⬜     |                                                                                                                                                                  |
| `pos/`                | ⬜     |                                                                                                                                                                  |
| `storage/`            | ⬜     |                                                                                                                                                                  |
| `documents/`          | ⬜     |                                                                                                                                                                  |
| `back-in-stock/`      | ⬜     |                                                                                                                                                                  |
| `wishlists/`          | ⬜     |                                                                                                                                                                  |
| `address-validation/` | ⬜     |                                                                                                                                                                  |
| `admin-onboarding/`   | ⬜     |                                                                                                                                                                  |
| `api-keys/`           | ⬜     |                                                                                                                                                                  |

## Infrastructure (`app/libs/`)

| Area        | Status | Notes |
| ----------- | ------ | ----- |
| `auth/`     | ⬜     |       |
| `alerting/` | ⬜     |       |
| `prisma/`   | ⬜     |       |
| `queue/`    | ⬜     |       |

## Routes (`app/routes/`)

| Area            | Status | Notes |
| --------------- | ------ | ----- |
| `storefront/`   | ⬜     |       |
| `admin/`        | ⬜     |       |
| `api/v1/`       | ⬜     |       |
| `api/admin/v1/` | ⬜     |       |
| `webhooks/`     | ⬜     |       |
| `auth/`         | ⬜     |       |

## UI

| Area                  | Status | Notes |
| --------------------- | ------ | ----- |
| `app/components/`     | ⬜     |       |
| `app/themes/default/` | ⬜     |       |
| `app/plugins/`        | ⬜     |       |
