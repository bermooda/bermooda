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

| Area                  | Status | Notes                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discounts/`          | ✅     | Lifecycle validation deduped; `summarizeCartLines` moved to `#/core/cart/lines`; removed unused `applyDiscount`, cart-discount CRUD, and CartDiscount read path.                                                                                                                                                                    |
| `cart/`               | ✅     | `summarizeCartLines` + `cartLineTotal` in `#/core/cart/lines`; all core/themes/emails/payments callers migrated; cart service helpers deduped.                                                                                                                                                                                      |
| `checkout/`           | ✅     | Shared `CHECKOUT_STEPS`, `CHECKOUT_CART_INCLUDE`, `parseCheckoutSessionFields`, `buildComputeTotalsParams`; repricing via `applyPriceListToCartLines`; removed dead `abandonCheckoutSession` and unused `couponCodes` param; fixed API 404 and tax-aware session cart in storefront loader.                                         |
| `orders/`             | ✅     | Shared `inventoryItemsFromLines` + `restoreOrderLineInventory`; simplified gift-card redemption; lightweight cancel fetch; removed unused `updateRefundStatus`.                                                                                                                                                                     |
| `catalog/`            | ✅     | Shared `translations.server` + `locale.server` helpers; search/content migrated; admin wired to publish/media/delete catalog APIs; removed unused variant CRUD, digital/bundle CRUD, tag helpers, and attribute option helpers.                                                                                                     |
| `payments/`           | ✅     | Renamed registry `createPaymentSession`; redirect providers charge `order.totalCents`; wired PSP refunds in `createRefund`; fixed Klarna/PayPal webhook shapes; merged `stripe-element` into `stripe.server.js`; removed dead `listProviders`, `verifyWebhook` wrapper, `registerKlarnaProvider`, and `listSavedPaymentMethods`.    |
| `shipping/`           | ✅     | Shared zone helpers + `resolveShippingOption`; normalized admin zone schema; fixed `freeOverCents` null, empty zones, carrier `priceCents`, pickup inventory checks; removed dead `registerCarrierProvider`; checkout validates shipping option JSON and uses persisted snapshot fallback; removed theme phantom shipping option.   |
| `tax/`                | ✅     | Shared `loadTaxConfig`/`resolveRegionRate`/`computeTaxCents`; wired `simplePercentProvider` to admin `tax.mode` + `tax.regions`; fixed `vatId` passthrough and inclusive per-line tax; removed dead tax class CRUD, `listProviders`, and `registerTaxJarProvider`.                                                                  |
| `pricing/`            | ✅     | Shared `isPriceListActive`, `buildPriceListGroupWhere`, `pickBestVariantPrice`, `resolveCustomerGroupIds`, batched `resolveVariantPrices`; channel lookup via `#/core/channels`; admin routes wired to core helpers; cart add/update reprices on quantity changes; removed unused price-list groups fetch.                          |
| `customers/`          | ✅     | Shared `buildCustomerSearchWhere`, `pickCustomerProfileFields`, address default helper; `listOrders` returns `{ orders, total }`; added `createCustomer`/`listCustomers`; wired admin + admin API; fixed API 404 on missing customer; removed unused `getCustomerByEmail`.                                                          |
| `inventory/`          | ✅     | Shared `filterTrackedInventoryItems`; batched `listInventoryLevelsForVariants`; `createLocation`, `listLocationsWithInventory`, `listRecentVariantsForInventory`; wired admin + admin API; product editor syncs default location quantity; removed dead `checkAvailability`/`getInventoryCount` and unused location re-exports.     |
| `gift-cards/`         | ✅     | Shared `normalizeGiftCardCode`, `buildGiftCardSearchWhere`, `parseIssueGiftCardInput`, and `isActiveGiftCard`; wired admin search/pagination and admin API pagination; fixed nested list response; duplicate-code guard; expiry check on redeem; removed dead order fallback lookup.                                                |
| `loyalty/`            | ✅     | Shared `parseLoyaltySettingsInput`, `normalizeReferralCode`, `getCustomerLoyaltySummary`, and ledger balance helper; paginated `listLoyaltyTransactions`; wired admin + admin API; checkout/account use shared summary helper.                                                                                                      |
| `store-credit/`       | ✅     | Shared `parseIssueStoreCreditInput`, `getCustomerStoreCreditSummary`, and `resolveStoreCreditRedemption`; deduped ledger balance/append logic; paginated `listLedgerEntries`; wired admin customer issue form and admin API; checkout/totals use shared summary/redemption helpers.                                                 |
| `collections/`        | ✅     | Shared search/input helpers, admin editor loaders, paginated `listCollections`; wired admin + admin API; removed dead `getCollectionProductIds` and unused rules re-exports.                                                                                                                                                        |
| `search/`             | ✅     | Shared `parseStorefrontSearchParams` + `parsePublicSearchParams`/`resolveSearchSort`; wired storefront + API routes; fixed API filters/sort mapping; removed dead `listProviders` and `searchWith`.                                                                                                                                 |
| `i18n/`               | ✅     | Shared `locales.js` constants/parsers, unified `translate`/`t`, `getAvailableLocales`, customer `preferredLocale` resolution, settings-backed enabled locales, wired storefront layout cookie + locale switcher validation.                                                                                                         |
| `themes/`             | ✅     | Shared manifest constants; merged preload/cache into index.server; synced client registry on registerTheme; admin helpers for settings/activation; removed dead server getStorefrontComponent and storefrontThemes export; fixed AccountAddressesPage themeId passthrough.                                                          |
| `plugins/`            | ✅     | Shared manifest/route helpers; registry + settings helpers; wired admin + storefront dispatchers; ctx.t uses default-locale messages; removed dead `loadPlugins`, `resolvePluginRoute`, and unused `plugin.{id}.enabled` writes.                                                                                                    |
| `webhooks/`           | ✅     | Shared event/input helpers, paginated `listSubscriptions`, `updateSubscription` for active toggle, validated event names, wired admin + admin API (PATCH, 404 on missing), removed unused `queueWebhookDelivery` export.                                                                                                            |
| `events/`             | ✅     | Shared `DOMAIN_EVENTS` registry in `#/core/events/names`; `beforeHookKey`/`isBeforeHookEvent` helpers; webhooks/audit/admin routes import canonical list; shipment API imports `isHookAbort` from events.                                                                                                                           |
| `settings/`           | ✅     | Shared keys/defaults, batch get/set, admin snapshot + parse/save helpers; wired admin route + admin API; set-currency validates enabled currencies; seedDefaults wired to bootstrap; deduped SEO/tax/shipping parsers.                                                                                                              |
| `rbac/`               | ✅     | Shared defaults, admin user CRUD helpers, role validation; wired admin settings routes and admin API; removed dead `resolveApiPermission`.                                                                                                                                                                                          |
| `audit/`              | ✅     | Shared list/entity helpers, paginated `listAuditLogs`, `getAuditLog`; wired admin audit-log + api-settings mutations; added admin API GET routes; renamed list payload to `auditLogs`.                                                                                                                                              |
| `exports/`            | ✅     | Shared CSV/input/serialization helpers, `loadProductTitleMap` for product exports, paginated `listScheduledExports`, `getScheduledExport`/`getExportRun` with 404, `resolveExportDownload`; wired admin routes; added admin API routes for scheduled exports and export runs.                                                       |
| `imports/`            | ✅     | Shared CSV parse via `#/core/exports`; import type/input/template helpers; aligned customer headers with export format; variant_id-aware product updates; wired admin template download + admin API POST; uses `createCustomer`/`updateCustomer` and catalog helpers; removed dead `csvCell` re-export and unused template exports. |
| `gdpr/`               | ✅     | Shared `DEFAULT_CONSENT`, `hasMarketingConsent`, consent input/form parsers, `getCustomerConsentSummary`; wired admin customer route; added admin API routes for consent, data export, and erase; marketing uses shared consent helper; `updateCustomerConsent` returns 404 on missing customer. |
| `marketing/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `reporting/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `returns/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `reviews/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `seo/`                | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `content/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `channels/`           | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `b2b/`                | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `subscriptions/`      | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `pos/`                | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `storage/`            | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `documents/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `back-in-stock/`      | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `wishlists/`          | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `address-validation/` | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `admin-onboarding/`   | ⬜     |                                                                                                                                                                                                                                                                                                                                     |
| `api-keys/`           | ⬜     |                                                                                                                                                                                                                                                                                                                                     |

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
