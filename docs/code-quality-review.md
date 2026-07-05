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

| Area                  | Status | Notes                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discounts/`          | ✅     | Lifecycle validation deduped; `summarizeCartLines` moved to `#/core/cart/lines`; removed unused `applyDiscount`, cart-discount CRUD, and CartDiscount read path.                                                                                                                                                                  |
| `cart/`               | ✅     | `summarizeCartLines` + `cartLineTotal` in `#/core/cart/lines`; all core/themes/emails/payments callers migrated; cart service helpers deduped.                                                                                                                                                                                    |
| `checkout/`           | ✅     | Shared `CHECKOUT_STEPS`, `CHECKOUT_CART_INCLUDE`, `parseCheckoutSessionFields`, `buildComputeTotalsParams`; repricing via `applyPriceListToCartLines`; removed dead `abandonCheckoutSession` and unused `couponCodes` param; fixed API 404 and tax-aware session cart in storefront loader.                                       |
| `orders/`             | ✅     | Shared `inventoryItemsFromLines` + `restoreOrderLineInventory`; simplified gift-card redemption; lightweight cancel fetch; removed unused `updateRefundStatus`.                                                                                                                                                                   |
| `catalog/`            | ✅     | Shared `translations.server` + `locale.server` helpers; search/content migrated; admin wired to publish/media/delete catalog APIs; removed unused variant CRUD, digital/bundle CRUD, tag helpers, and attribute option helpers.                                                                                                   |
| `payments/`           | ✅     | Renamed registry `createPaymentSession`; redirect providers charge `order.totalCents`; wired PSP refunds in `createRefund`; fixed Klarna/PayPal webhook shapes; merged `stripe-element` into `stripe.server.js`; removed dead `listProviders`, `verifyWebhook` wrapper, `registerKlarnaProvider`, and `listSavedPaymentMethods`.  |
| `shipping/`           | ✅     | Shared zone helpers + `resolveShippingOption`; normalized admin zone schema; fixed `freeOverCents` null, empty zones, carrier `priceCents`, pickup inventory checks; removed dead `registerCarrierProvider`; checkout validates shipping option JSON and uses persisted snapshot fallback; removed theme phantom shipping option. |
| `tax/`                | ✅     | Shared `loadTaxConfig`/`resolveRegionRate`/`computeTaxCents`; wired `simplePercentProvider` to admin `tax.mode` + `tax.regions`; fixed `vatId` passthrough and inclusive per-line tax; removed dead tax class CRUD, `listProviders`, and `registerTaxJarProvider`.                                                                |
| `pricing/`            | ✅     | Shared `isPriceListActive`, `buildPriceListGroupWhere`, `pickBestVariantPrice`, `resolveCustomerGroupIds`, batched `resolveVariantPrices`; channel lookup via `#/core/channels`; admin routes wired to core helpers; cart add/update reprices on quantity changes; removed unused price-list groups fetch.                        |
| `customers/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `inventory/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `gift-cards/`         | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `loyalty/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `store-credit/`       | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `collections/`        | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `search/`             | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `i18n/`               | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `themes/`             | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `plugins/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `webhooks/`           | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `events/`             | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `settings/`           | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `rbac/`               | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `audit/`              | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `exports/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `imports/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `gdpr/`               | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `marketing/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `reporting/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `returns/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `reviews/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `seo/`                | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `content/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `channels/`           | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `b2b/`                | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `subscriptions/`      | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `pos/`                | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `storage/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `documents/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `back-in-stock/`      | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `wishlists/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `address-validation/` | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `admin-onboarding/`   | ⬜     |                                                                                                                                                                                                                                                                                                                                   |
| `api-keys/`           | ⬜     |                                                                                                                                                                                                                                                                                                                                   |

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
