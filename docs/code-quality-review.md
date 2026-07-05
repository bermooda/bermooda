# Code quality review tracker

Incremental quality passes over the codebase. Each area gets a review of implementation quality, reusability, and unnecessary complexity. Mark areas **done** after review (and any applied fixes).

## Status legend

- ⬜ Pending
- ✅ Done (reviewed; improvements applied or documented as follow-ups)

## Core domain (`app/core/`)

| Area                  | Status | Notes                                                                                                                                                                                                                |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discounts/`          | ✅     | Lifecycle validation deduped; cart line summary helper; `applyDiscount` reuses `validateDiscount`. Cart-discount CRUD + legacy `applyDiscount` unused by routes — follow-up: wire cart coupons or remove dead paths. |
| `cart/`               | ⬜     |                                                                                                                                                                                                                      |
| `checkout/`           | ⬜     |                                                                                                                                                                                                                      |
| `orders/`             | ⬜     |                                                                                                                                                                                                                      |
| `catalog/`            | ⬜     |                                                                                                                                                                                                                      |
| `payments/`           | ⬜     |                                                                                                                                                                                                                      |
| `shipping/`           | ⬜     |                                                                                                                                                                                                                      |
| `tax/`                | ⬜     |                                                                                                                                                                                                                      |
| `pricing/`            | ⬜     |                                                                                                                                                                                                                      |
| `customers/`          | ⬜     |                                                                                                                                                                                                                      |
| `inventory/`          | ⬜     |                                                                                                                                                                                                                      |
| `gift-cards/`         | ⬜     |                                                                                                                                                                                                                      |
| `loyalty/`            | ⬜     |                                                                                                                                                                                                                      |
| `store-credit/`       | ⬜     |                                                                                                                                                                                                                      |
| `collections/`        | ⬜     |                                                                                                                                                                                                                      |
| `search/`             | ⬜     |                                                                                                                                                                                                                      |
| `i18n/`               | ⬜     |                                                                                                                                                                                                                      |
| `themes/`             | ⬜     |                                                                                                                                                                                                                      |
| `plugins/`            | ⬜     |                                                                                                                                                                                                                      |
| `webhooks/`           | ⬜     |                                                                                                                                                                                                                      |
| `events/`             | ⬜     |                                                                                                                                                                                                                      |
| `settings/`           | ⬜     |                                                                                                                                                                                                                      |
| `rbac/`               | ⬜     |                                                                                                                                                                                                                      |
| `audit/`              | ⬜     |                                                                                                                                                                                                                      |
| `exports/`            | ⬜     |                                                                                                                                                                                                                      |
| `imports/`            | ⬜     |                                                                                                                                                                                                                      |
| `gdpr/`               | ⬜     |                                                                                                                                                                                                                      |
| `marketing/`          | ⬜     |                                                                                                                                                                                                                      |
| `reporting/`          | ⬜     |                                                                                                                                                                                                                      |
| `returns/`            | ⬜     |                                                                                                                                                                                                                      |
| `reviews/`            | ⬜     |                                                                                                                                                                                                                      |
| `seo/`                | ⬜     |                                                                                                                                                                                                                      |
| `content/`            | ⬜     |                                                                                                                                                                                                                      |
| `channels/`           | ⬜     |                                                                                                                                                                                                                      |
| `b2b/`                | ⬜     |                                                                                                                                                                                                                      |
| `subscriptions/`      | ⬜     |                                                                                                                                                                                                                      |
| `pos/`                | ⬜     |                                                                                                                                                                                                                      |
| `storage/`            | ⬜     |                                                                                                                                                                                                                      |
| `documents/`          | ⬜     |                                                                                                                                                                                                                      |
| `back-in-stock/`      | ⬜     |                                                                                                                                                                                                                      |
| `wishlists/`          | ⬜     |                                                                                                                                                                                                                      |
| `address-validation/` | ⬜     |                                                                                                                                                                                                                      |
| `admin-onboarding/`   | ⬜     |                                                                                                                                                                                                                      |
| `api-keys/`           | ⬜     |                                                                                                                                                                                                                      |

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

## Cross-cutting follow-ups (from reviews)

| Item                                                                                                     | Source    | Priority                                                                |
| -------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| Cart coupon persistence (`applyCouponToCart` / `CartDiscount` table) never wired to storefront           | discounts | Low — checkout uses session `couponCode` instead                        |
| Legacy `applyDiscount` only used in tests; production uses `resolvePromotions` + `persistOrderDiscounts` | discounts | Low — keep for API stability or deprecate                               |
| Repeated `lines.reduce(... priceCentsSnapshot * quantity)` across core/themes                            | discounts | Medium — consider shared `summarizeCartLines` in `#/core/cart` or utils |
