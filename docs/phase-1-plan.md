# bermooda — Phase 1 Implementation Plan

## Context

Build **bermooda**, an open-source ecommerce shop on top of the existing CursorStack template (React Router 7 SSR + Prisma 7/SQLite + better-auth + Tailwind 4 + LiteQuu + Resend + Pino + Fly.io/LiteFS, with manually configured Tigris/S3-compatible storage). Single app serves both the storefront (themed) and admin back office. Designed for extensibility: third-party developers author **themes** (folder-based React components) and **plugins** (folder-based, hook-based, JSON storage). Public REST API is reserved at `/api/*` but deferred to a later phase. v1 adds multi-currency + i18n and a Vitest test suite.

**Tenancy:** single shop per install. **Admin/staff and customers are separate user models** (no shared accounts; isolated sessions). All keep-it-simple defaults: Stripe Checkout for v1 payment, flat-rate shipping, simple-percent tax — all pluggable via the provider API. **Default currency `USD`**, also-enabled-by-default `EUR` and `AUD`. **Locale is cookie-driven, never in URLs** — every storefront URL is locale-agnostic and the active locale comes from the `locale` cookie.

---

## Repo verification constraints

These are implementation constraints verified against the current CursorStack repo and must be handled before or during Phase 1:

- **Routes are static in [app/routes.js](../app/routes.js).** Route filenames are not auto-discovered. Theme/plugin route contribution must be implemented through static dispatcher routes or build-time route generation, not by changing React Router routes at runtime.
- **`app/core/*` is the new canonical ecommerce domain layer.** Rewrite the repo's agent rules and docs that currently point domain workflows at `app/services` so future work consistently uses `app/core/*` for shop engine code. Keep `app/libs/*` for low-level infrastructure clients.
- **Server-only modules must use `*.server.js`.** Provider adapters such as Stripe should be named `stripe.server.js`, not plain `stripe.js`.
- **Dual better-auth stacks are required.** The current app has one better-auth instance with `User`, `Session`, `Account`, `Verification`, `TwoFactor`, and the `organization()` plugin. Phase 1 splits this into an admin auth instance and a customer auth instance with separate base paths, cookie prefixes, models, clients, and route middleware.
- **Storage is manually configured.** The README describes `fly storage create`, but there is no storage client, env mapping, upload service, or package-level integration today. Phase 1 must document manual storage setup and make the app read explicit env vars; do not rely on automated provisioning.
- **Testing and CI are new work.** The repo has no Vitest config/scripts today, and the existing Fly workflow is under `.github/_workflows/`, not GitHub's runnable `.github/workflows/` path.

---

## High-level architecture

Three surfaces in one app:
- `/` — Storefront, rendered through the active theme.
- `/admin/*` — Admin back office, core-owned UI (not themed).
- `/api/*` — Reserved namespace; not implemented in v1.

**Folder layout (additions to existing `app/`):**

```
app/
  core/                  # The shop "engine" — domain logic, no UI; intentional replacement for SaaS app/services domain layer
    catalog/             # products, variants, categories, attributes, media
    cart/                # cart state, line items, totals, promotions
    checkout/            # checkout pipeline, validation, address, shipping, payment
    orders/              # order lifecycle, fulfillment, returns
    customers/           # customer profile, addresses, order history
    payments/            # provider registry + Stripe built-in adapter
    shipping/            # rate registry + flat-rate built-in adapter
    tax/                 # tax registry + simple-percent adapter
    settings/            # shop-wide settings (read-through TTL-cached)
    events/              # in-process lifecycle event bus
    plugins/             # plugin loader, registry, hook dispatcher
    themes/              # theme loader, active-theme resolver, slot system
    i18n/                # locale resolver, translation service, message catalogs
    currency/            # currency resolver, VariantPrice lookup, Intl formatting
    storage/             # media storage abstraction + Tigris adapter
  themes/
    default/             # bundled default theme
      manifest.js        # name, version, settings schema, links, locales
      routes.js          # optional route metadata consumed by static storefront dispatchers
      components/        # Layout, ProductCard, ProductPage, Cart, Checkout, ...
      i18n/<locale>.json # per-locale message catalogs
      assets/
  plugins/
    sample-analytics/    # bundled sample plugin, demonstrates the contract
      manifest.js
      index.server.js    # hook handlers
      admin/routes.js    # admin page descriptors consumed by static plugin dispatchers
      blocks/            # slot block components
      i18n/<locale>.json
  routes/
    admin/               # core back-office routes
      _public.jsx        # public admin shell (login, forgot-password, verify-2fa)
        login.jsx
        forgot-password.jsx
        reset-password.jsx
        verify-2fa.jsx
      _layout.jsx        # protected shell — admin auth via RR7 route middleware
        dashboard.jsx
        products/...
        categories/...
        orders/...
        customers/...
        discounts/...
        themes.jsx
        plugins.jsx
        settings/...
        logout.jsx
    storefront/          # static storefront routes; loaders stay core-owned and render active theme components
      _layout.jsx        # delegates to active theme's Layout
      index.jsx
      products.$slug.jsx
      categories.$slug.jsx
      cart.jsx
      checkout.$step.jsx
      thank-you.$orderNumber.jsx
      account/...        # customer area (orders, addresses, profile)
      account/login.jsx, register.jsx, logout.jsx, forgot-password.jsx
    webhooks/
      $provider.jsx      # generic dispatcher → provider.verifyWebhook()
    api/                 # reserved (later phase)
  test/
    factories/           # test fixtures (User, Customer, Product, ...)
    helpers/             # db-per-worker setup, seed helpers
```

**Route wiring note:** the tree above is logical. Every public URL must still be added to [app/routes.js](../app/routes.js) with `index`, `layout`, `prefix`, and `route` from React Router's route config API.

**Layering rule:** routes call `app/core/*` services; themes only render UI; plugins extend through registered hooks/providers/blocks. Themes never import `app/core/*` directly — they consume a stable surface re-exported from `app/core/index.js`. `app/core/*` is the canonical home for ecommerce domain workflows. `app/services/*` is removed from the shop architecture except for temporary files during the first cleanup commit or future non-shop legacy integrations.

---

## Auth model (separate admin & customer)

- **`User`** — admin/staff only. Existing better-auth instance. Add `role: 'admin' | 'staff'` because current roles live on `Member.role`, which disappears when `Organization`/`Member` are removed. 2FA stays default-on. Drop SaaS-era customer-style fields.
- **`Customer`** — new model + parallel better-auth tables (`CustomerSession`, `CustomerAccount`, `CustomerVerification`; add `CustomerTwoFactor` if customer 2FA is enabled). Email/password + Google OAuth + email verification. 2FA optional.
- **Admin auth instance:** create `app/libs/auth/admin.server.js` from the current better-auth setup, remove the `organization()` plugin, keep admin 2FA, use a dedicated admin cookie prefix, and serve it under an admin auth base path such as `/admin/auth/*`.
- **Customer auth instance:** create `app/libs/auth/customer.server.js` with its own better-auth config, `Customer*` models, customer cookie prefix, customer redirect URLs, and customer auth base path such as `/account/auth/*`.
- **Adapter validation before schema rewrite:** prove better-auth 1.6.x + Prisma 7 can run the admin and customer auth instances against one Prisma client with the selected `Customer*` model-name configuration. The implementation direction remains two auth instances; if the Prisma adapter cannot support the selected names directly, add the smallest custom adapter or table-mapping shim needed to preserve the two-instance design.
- **No cross-table linkage.** Documented as intentional: a person who is both staff and customer holds two separate accounts.
- **Session isolation:** different cookie names and different auth API base paths so a staff member can be logged into both surfaces simultaneously. Keep the admin auth API separate from the customer account auth API; do not reuse the current single `/auth/*` route for both.
- **Auth surfaces:** `/admin/login` etc. for admins; `/account/login` etc. for customers.

---

## Data model (Prisma)

**Catalog**
- `Product` — `id`, `defaultSlug`, `status` (`draft`|`active`|`archived`), `requiresShipping`, `taxClassId?`, SEO fields, timestamps. Translatable fields (`title`, `description`, `metaTitle`, `metaDescription`) live in `Translation`; localized slugs live in `Slug` so uniqueness can be enforced.
- `ProductVariant` — `id`, `productId`, `sku` (unique), `inventoryQty`, `inventoryTracked`, `weightGrams?`, `optionValues` (JSON). **Price moved out** to `VariantPrice`.
- `VariantPrice` — `id`, `variantId`, `currency`, `priceCents`, `compareAtPriceCents?`. Unique on (`variantId`, `currency`). Default-currency row is required; non-default currency rows are optional for browsing only, not for checkout fallback.
- `ProductOption`, `ProductOptionValue` — option metadata.
- `Category` — `id`, `parentId?`, `position`, `defaultSlug`. Translatable fields in `Translation`; localized slugs in `Slug`.
- `ProductCategory` — join.
- `Media` — `id`, `url`, `storageKey?`, `altText?`, `mimeType`, `width?`, `height?`. `ProductMedia` join with `position`. v1 adds the storage abstraction around a manually configured storage client; this is not present in the template today.

**Customers**
- `Customer` — `id`, `email` (unique), `emailVerified`, `name?`, `phone?`, `marketingOptIn`, `preferredLocale?`, `preferredCurrency?`, timestamps.
- `CustomerSession`, `CustomerAccount`, `CustomerVerification`, `CustomerTwoFactor?` — better-auth tables (separate instance; include `CustomerTwoFactor` only if customer 2FA is enabled).
- `Address` — `id`, `customerId`, `type`, name/lines/city/region/postal/country/phone, `isDefault`.

**Cart & checkout**
- `Cart` — `id`, `token`, `customerId?`, `currency` (locked on first add), `locale`, `expiresAt`, timestamps.
- `CartLine` — `id`, `cartId`, `variantId`, `quantity`, `priceCentsSnapshot`, `titleSnapshot` (locale-resolved at add time). `priceCentsSnapshot` must be an exact price in `Cart.currency`; do not snapshot fallback USD cents into an EUR/AUD cart.
- `CheckoutSession` — `id`, `cartId`, `email`, `shippingAddressId?`, `billingAddressId?`, `shippingMethodId?`, `paymentProviderId?`, `status`, `expiresAt`.

**Orders**
- `Order` — `id`, `number` (sequential), `customerId?` (nullable for guest orders), `email`, `currency`, `locale`, totals (`subtotal`, `shipping`, `tax`, `discount`, `total`), `status`, `paymentStatus`, `fulfillmentStatus`, `paymentProvider`, `paymentRef?`, `createdAt`, `updatedAt`, **denormalized JSON snapshot** of shipping/billing addresses. (No separate `placedAt`: an `Order` row is only created on successful placement, so `createdAt` is the placement timestamp.)
- `OrderLine` — `id`, `orderId`, `variantId?`, `sku`, `title`, `quantity`, `unitPriceCents`, `lineTotalCents`, `taxCents`.
- `Shipment` — `id`, `orderId`, `carrier?`, `tracking?`, `status`, `shippedAt?`.
- `Refund` — `id`, `orderId`, `amountCents`, `reason?`, `providerRef?`, timestamps.

**Discounts**
- `Discount` — `id`, `code` (unique), `type` (`percent`|`fixed`), `value`, `appliesTo` (`order`|`shipping`), `minSubtotalCents?`, `startsAt?`, `endsAt?`, `maxUses?`, `usedCount`, `active`.

**Plugin & settings & misc**
- `PluginData` — `id`, `pluginId`, `key`, `value` (JSON string), timestamps. Unique on (`pluginId`, `key`).
- `Setting` — `id`, `key` (unique), `value` (JSON), `updatedAt`. Holds shop name, contact email, `defaultCurrency` (default `USD`), `currencies[]` (default `['USD','EUR','AUD']`), `defaultLocale` (default `en`), `locales[]`, `activeTheme`, theme settings, `enabledPlugins[]`, `pluginOrder[]`, tax mode (inclusive/exclusive), tax/shipping config.
- `Translation` — `id`, `entityType` (`product`|`category`|`page`), `entityId`, `locale`, `field`, `value`. Unique on (`entityType`, `entityId`, `locale`, `field`).
- `Slug` — `id`, `entityType` (`product`|`category`|`page`), `entityId`, `locale`, `value`. Unique on (`entityType`, `locale`, `value`) and (`entityType`, `entityId`, `locale`).
- `WebhookEvent` — `id`, `provider`, `eventId`, `receivedAt`. Unique on (`provider`, `eventId`). Used for webhook idempotency.

---

## Multi-currency

- Currencies enabled in `Setting.currencies` (default `['USD','EUR','AUD']`); `defaultCurrency` is `USD`.
- Per-variant prices live in `VariantPrice` rows; default-currency (USD) row required, others optional.
- Missing active-currency price may fall back to default currency **only for non-cart browsing display**, and the UI must label the displayed currency honestly. Add-to-cart and checkout require an exact `VariantPrice` row in `Cart.currency`; otherwise show a clear unavailable-in-currency error or ask the customer to switch currency.
- Active currency resolution: explicit `currency` cookie / customer preference → plugin-set hint (geo) → `defaultCurrency`.
- `Cart.currency` locked on first add-to-cart; cart switch requires clearing.
- No FX/auto-conversion in core — manual prices per currency. FX provider via plugin.
- Exposed to themes through `useShop().currency` and `formatPrice(cents, currency?)` (uses `Intl.NumberFormat`).

---

## i18n

- Locales enabled in `Setting.locales` (e.g. `['en','de','fr']`); `defaultLocale` is `en`.
- Translatable content lives in `Translation`. Untranslated fields fall back to default locale.
- **No locale in URL.** Locale is selected on every request from a `locale` cookie. Storefront URLs are locale-agnostic (e.g. `/products/black-tee`). When the cookie is absent, the resolver picks a locale and sets the cookie on the response.
- Active locale resolution chain: `locale` cookie → authenticated customer's `preferredLocale` → `Accept-Language` (negotiated against `Setting.locales`) → `defaultLocale`. Result is set on the response cookie so subsequent requests are stable.
- Locale switcher (storefront and admin) writes to the `locale` cookie, then triggers a revalidation; backend always reads locale from the cookie via a `getRequestLocale(request)` helper.
- Slugs are translatable per locale via `Slug`; the same product's URL is therefore the same string regardless of UI locale unless the admin authors a translated slug. Slug uniqueness is enforced by `Slug` per (`entityType`, `locale`, `value`).
- UI strings: lightweight in-house resolver in `app/core/i18n/`. Catalogs at `app/core/i18n/messages/<locale>.json`, `app/themes/<name>/i18n/<locale>.json`, `app/plugins/<name>/i18n/<locale>.json`. Plugin/theme manifests declare a `locales` array; catalogs auto-discovered.
- Theme + plugin code uses `useT()`; admin UI also runs through `useT()`. Number/currency/date formatting via `Intl`.

---

## Storage

- Media storage is configured manually by the operator, not automatically provisioned by the app.
- Add `app/core/storage/` with a small server-only client wrapper that reads explicit env vars for endpoint, region, bucket, access key, secret key, and public URL/base URL.
- Treat Tigris as the documented Fly.io storage target for production, but keep the app-side interface provider-neutral enough for any S3-compatible service.
- Update `.env.example` and `docs/storage.md` with exact manual setup steps, required env vars, local-development behavior, and failure modes.
- Admin media upload UI talks only to `app/core/storage/*`; no route or admin component imports a storage SDK directly.

---

## Theme contract

A theme is a folder in `app/themes/<name>/`.

- **Manifest** — `name`, `version`, `author`, `settings` schema (rendered as a form on `/admin/themes`), `links` (assets pulled into `<head>`), `locales`.
- **Routes** — React Router routes remain static in [app/routes.js](../app/routes.js). Theme `routes.js` may declare component mappings and optional page metadata consumed by the core storefront route modules; it cannot add arbitrary runtime URLs in v1. Loader stays core-owned; component is theme-owned.
- **Required components** — `Layout`, `HomePage`, `ProductCard`, `ProductGrid`, `ProductPage`, `CategoryPage`, `CartPage`, `CheckoutLayout` + step components, `CheckoutThankYouPage`, `AccountLayout` + account pages, `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `NotFoundPage`. Validated by `defineTheme()` at build time; missing components fail fast.
- **Slots** — `<Slot name="home.hero" />`, `<Slot name="product.afterDescription" />`, etc. Plugins register block components into slots via manifest. v1 ships ~10 well-known slot names; no block-builder UI in v1.
- **Data access** — themes consume loader data + `useShop()` + `useT()`. They never import `app/core/*` internals directly — only the public surface re-exported from `app/core/index.js`.
- **Active theme resolution** — `Setting.activeTheme` (TTL-cached). Switching among source-bundled themes requires no rebuild. Do not tree-shake inactive themes in v1 unless theme selection becomes build-time only; runtime no-rebuild switching and inactive-theme tree-shaking are conflicting goals.
- **Hot-reload** works in dev because themes are source files.
- **Dev guide** — `docs/themes.md` covers contract, slot list, helper hooks, fork-the-default walkthrough.

---

## Plugin contract

A plugin is a folder in `app/plugins/<name>/`.

- **Manifest** — `name`, `version`, `displayName`, `description`, `settings` schema (form rendered on `/admin/plugins/<name>`), `contributes` (declarative: `adminRoutes`, `storefrontRoutes`, `blocks[]`, `paymentProviders[]`, `shippingProviders[]`, `taxProviders[]`), `locales`.
- **Server entry** — `index.server.js` exports `defineHooks({ 'order.created': fn, ... })`. Hook handlers receive `{ ...payload, ctx }` where `ctx = { db, settings, plugin: { get, set, delete }, logger, queue, emit, t }`. Plugin data flows through `ctx.plugin.*` → `PluginData` namespaced by `pluginId`.
- **Lifecycle events emitted by core (v1):** `cart.created`, `cart.updated`, `cart.itemAdded`, `cart.itemRemoved`, `checkout.started`, `checkout.completed`, `order.created`, `order.cancelled`, `order.fulfilled`, `order.refunded`, `payment.authorized`, `payment.completed`, `payment.failed`, `payment.refunded`, `customer.registered`, `customer.loggedIn`, `product.viewed`, `product.created`, `product.updated`, `product.deleted`. Hooks awaited in registration order; only checkout-critical paths propagate errors, otherwise errors are caught + logged.
- **Provider registration** — `defineProvider('payment'|'shipping'|'tax', spec)`. Built-in Stripe/flat-rate/simple-percent register via the same API (no privileged path).
- **Admin route contribution** — `app/plugins/<name>/admin/routes.js` exports page descriptors rendered by a static `/admin/plugins/:pluginId/*` dispatcher route. Plugins cannot mutate [app/routes.js](../app/routes.js) at runtime.
- **Storefront route contribution** — `app/plugins/<name>/storefront/routes.js` exports page descriptors rendered by a static `/apps/:pluginId/*` dispatcher route.
- **Block contribution** — for each declared slot, plugin exports `app/plugins/<name>/blocks/<slot-name>.jsx`. Render order from `Setting.pluginOrder`.
- **Lifecycle** — `enable`/`disable` toggle in `Setting.enabledPlugins`. Optional `onEnable`/`onDisable` exports run on toggle. Folders are the source of truth; data persists across disable/enable.
- **Sample plugin** — `app/plugins/sample-analytics/` ships in v1: `order.created` hook, admin page with recent events, `product.afterDescription` block, reads/writes `PluginData`. Canonical reference.
- **Dev guide** — `docs/plugins.md`.

---

## Payment / shipping / tax flow

**Checkout pipeline** — 4-step state machine on `CheckoutSession`:

1. **Address** — collect shipping + billing addresses, capture email.
2. **Shipping** — query enabled shipping providers for rates given cart + address; customer selects.
3. **Payment** — query enabled payment providers; customer selects. Provider's `startPayment()` returns redirect URL or client-side handoff.
4. **Review** — server re-computes totals, customer confirms, payment initiated. On success: `Order` row created, cart cleared, `order.created` fires.

Step routes: `/checkout/address`, `/checkout/shipping`, `/checkout/payment`, `/checkout/review`, `/thank-you/:orderNumber`.

**Totals engine** (`app/core/checkout/totals.server.js`):

```
subtotal = sum(line.unitPrice * line.qty)   # exact VariantPrice row for cart.currency
discount = applyDiscounts(subtotal, codes)
shipping = activeShippingProvider.quote(...)
tax      = activeTaxProvider.compute(subtotal - discount, shippingAddress)
total    = subtotal - discount + shipping + tax
```

Computed on every cart mutation, every checkout step, and re-run server-side at order placement. Result snapshotted onto `Order`.

**Built-in providers**
- **Payment — Stripe** (default: Stripe Checkout, hosted; Elements available later). This is a rewrite of the current subscription-oriented `app/services/stripe.server.js`, not a rename. Use dynamic Checkout line items / `price_data`, order or checkout metadata, signature verification, idempotency via (`provider`, `eventId`), refunds, and Pino logging.
- **Shipping — flat-rate** (per region in admin: free over X supported).
- **Tax — simple-percent** (per country/region; tax-inclusive vs exclusive shop-wide setting).

**Inventory** — atomic decrement at order creation; `inventoryTracked=false` skipped; `INSUFFICIENT_INVENTORY` failure sends customer back to cart. No reservations in v1.

**Refunds** — admin "Refund" button (full or partial) routes through provider's `refund()`; `Refund` row recorded; `payment.refunded` fires.

**Webhook receiver** — `routes/webhooks/$provider.jsx` resolves provider from registry and calls `verifyWebhook()`. Plugin payment providers share this static dispatcher route; they do not register their own React Router modules at runtime.

---

## Admin back office

`/admin/*` is built once in core (Tailwind + Headless UI, both already in repo). Not themed.

- **Sidebar:** Dashboard, Orders, Products, Categories, Customers, Discounts, Themes, Plugins, Settings.
- **Topbar:** search, current admin user, theme/dark-mode toggle, **locale switcher** (admin UI runs through `useT()`).
- **Pages:**
  - **Dashboard** — KPI tiles + recent orders + plugin-contributed widgets via `dashboard.widgets` slot.
  - **Orders** — list/filter, detail (line items, payment events, fulfillment, refund, manual notes).
  - **Products** — list + create/edit (translatable fields with locale tabs, options, variants editor, **per-currency price grid**, media uploader through the manually configured storage client, categories, SEO).
  - **Categories** — tree editor with drag-to-reorder, locale tabs for translatable fields.
  - **Customers** — list/search, detail (addresses, order history), manual create.
  - **Discounts** — CRUD.
  - **Themes** — list, current selection, manifest-driven settings form, preview link.
  - **Plugins** — list, enable/disable, drag-to-reorder, manifest-driven settings form, link to plugin admin pages.
  - **Settings** — Shop name, contact email, currencies + default (USD/EUR/AUD shipped enabled by default, USD default), locales + default, tax mode, tax regions, shipping zones, admin user CRUD, email templates.
- **Auth gate:** RR7 route middleware (already enabled via `future.v8_middleware: true` in [react-router.config.js](../react-router.config.js)) attached to the admin `_layout.jsx`. The middleware reads the admin session cookie and redirects to `/admin/login` on failure — loaders no longer need per-handler `requireAdmin()` calls. The `account/*` tree uses the same pattern with the customer session cookie. Staff and admin equal access in v1; granular permissions deferred.
- **Email templates** — order confirmation, password reset (admin & customer), customer welcome, abandoned cart (basic). React Email in `app/emails/shop/`. Triggered via existing `app/emails/job.server.js` queue. Translatable per locale.

---

## Testing (Vitest)

**Setup**
- Add `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `happy-dom`, `supertest` to devDependencies.
- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`.
- `vitest.config.js` with two projects: `unit` (happy-dom env) and `server` (node env). `#/*` alias mirrored from `vite.config.js`. Coverage thresholds **80% for `app/core/**`**.
- Test fixtures: in-memory SQLite per worker via `@prisma/adapter-better-sqlite3`. `vitest-setup.js` runs `prisma migrate deploy` against a tmp file once per worker; truncates between tests. Factory helpers in `app/test/factories/`.
- CI: create `.github/workflows/` entries to run `npm run test:coverage`, `npm run lint`, and `npm run build` on PRs.

**Coverage targets (v1 must-haves):**
1. **Totals engine** — subtotal, discount, shipping, tax, exact cart-currency price resolution, browsing-only currency fallback, tax-inclusive vs exclusive, edge cases.
2. **Cart service** — add/remove/update line, currency lock on first add, snapshot pricing, expiry, guest→customer cart merge on login.
3. **Checkout pipeline** — step transitions, validation, server-side recompute, idempotent order creation, inventory decrement (incl. INSUFFICIENT_INVENTORY race-loss).
4. **Order service** — create from checkout, status transitions, refund flow, fulfillment.
5. **Plugin loader** — manifest validation, hook registration, dispatch order, error isolation, `ctx.plugin.*` namespacing, enable/disable lifecycle.
6. **Theme resolver** — active resolution, manifest validation, component mapping precedence, fallback to core defaults, missing-component fail-fast.
7. **Provider registry** — register/lookup, no-privileged-path-for-built-ins assertion, `defineProvider` validation.
8. **i18n resolver** — locale resolution chain, fallback, missing-key behavior, plugin/theme catalog merging.
9. **Translation service** — read with fallback, write per locale, `Slug` uniqueness per locale/entity type.
10. **Currency service** — active currency resolution, exact checkout `VariantPrice` lookup, browsing-only fallback behavior, `Intl` formatting per locale.
11. **Stripe payment adapter** — `startPayment` shape, webhook signature verification (mocked), idempotent replay, refund flow.
12. **Webhook idempotency** — `WebhookEvent` replay-skip behavior.
13. **Discount engine** — percent vs fixed, min subtotal, expiry, max-uses.
14. **Inventory** — atomic decrement, race condition, `inventoryTracked=false` skip.
15. **Auth boundaries** — admin/customer route middleware redirects, customer-vs-admin session isolation, dual auth API base paths, guest cart token rotation on login.
16. **Sample plugin** — integration test exercising the plugin contract end-to-end via `order.created`.
17. **Default theme** — smoke test that all required components render with mock loader data.

`docs/testing.md` documents conventions: `.test.js` (unit), `.test.server.js` (server), factories pattern, db-per-worker pattern.

---

## Removals & cleanup from existing template (first commit)

**Schema ([prisma/schema.prisma](../prisma/schema.prisma))**
- Drop the `Organization`, `Member`, `Invitation`, `Subscription` models.
- Drop the `Session.activeOrganizationId` column (added by the better-auth `organization` plugin; orphaned once the plugin is removed).
- Replace existing migrations with a fresh initial migration.

**Subscription / billing cascade** (knock-on from dropping `Subscription`)
- [app/services/stripe.server.js](../app/services/stripe.server.js) — **rewrite** (not just move) into `app/core/payments/stripe.server.js`: drop the subscription `checkout.session` helper and `customer.subscription.*` event handling; keep only one-time-payment Stripe Checkout + signature verification.
- [app/routes/webhooks/stripe.jsx](../app/routes/webhooks/stripe.jsx) — drop the existing subscription event handlers; the Stripe webhook now flows through the generic `routes/webhooks/$provider.jsx` dispatcher.
- [app/components/landing/hero.jsx](../app/components/landing/hero.jsx) — remove the `/checkout/polar?...` CTA link.
- [app/config.js](../app/config.js) — drop the `polar.plans` block.

**Polar removal**
- [app/services/polar.server.js](../app/services/polar.server.js) — drop.
- [app/routes/checkout/polar.jsx](../app/routes/checkout/polar.jsx), [app/routes/webhooks/polar.jsx](../app/routes/webhooks/polar.jsx) — drop.
- `@polar-sh/remix` dependency — remove from [package.json](../package.json).

**SaaS / organization scaffolding**
- [app/routes/app/*](../app/routes/app/) — drop (`_layout.jsx`, `dashboard.jsx`, `organization.jsx`, `settings.jsx`, `support.jsx`); replaced by `app/routes/admin/*`.
- [app/routes/organization/accept-invitation.jsx](../app/routes/organization/accept-invitation.jsx) — drop (the only file under `routes/organization/`).
- [app/libs/auth/index.server.js](../app/libs/auth/index.server.js) — remove the better-auth `organization` plugin import + config block (the client-side `organizationClient` plugin import in `app/libs/auth/client.js` goes too).

**Agent rules / architecture docs**
- [.cursor/rules/general.mdc](../.cursor/rules/general.mdc), [.cursor/rules/react-router/routes.mdc](../.cursor/rules/react-router/routes.mdc), [.cursor/rules/libs-services.mdc](../.cursor/rules/libs-services.mdc), and any other local rule that says domain workflows belong in `app/services` — rewrite to say ecommerce domain workflows belong in `app/core/*`; `app/libs/*` remains infrastructure and SDK clients.
- [AGENTS.md](../AGENTS.md) — add a short note that Phase 1 moves shop engine code to `app/core/*` and future agents should not introduce new ecommerce workflows under `app/services/*`.

**Polish (drive-bys with the same first commit)**
- [app/utils/logger.server.js](../app/utils/logger.server.js) — change the default Pino `name` from the stale `easyedit-order-editing` to `bermooda`.
- [README.md](../README.md) — fix the dev URL from `http://localhost:5173` to `http://localhost:3000`.

**Kept:** better-auth, Resend + React Email, LiteQuu, Pino, `@isaacs/ttlcache` (used for the `Setting` cache via [app/utils/cache.server.js](../app/utils/cache.server.js)), Telegram, Tailwind, Headless UI, Heroicons, oxlint/oxfmt, LiteFS, manually configured Tigris/S3-compatible storage, `fly.toml`.

---

## Preflight implementation checkpoints

Complete these before the broad schema/router rewrite:

1. **Dual auth proof:** prove `app/libs/auth/admin.server.js` and `app/libs/auth/customer.server.js` can coexist with separate cookie prefixes, API base paths, route handlers, client helpers, and `Customer*` Prisma models. Record the exact model-name config and a passing admin login/session + customer login/session check in `docs/auth.md`.
2. **Theme/plugin routing proof:** implement a tiny static dispatcher prototype for `/apps/:pluginId/*` and one storefront theme component mapping. Confirm no design depends on runtime mutation of [app/routes.js](../app/routes.js).
3. **Storage proof:** define the manually configured storage client API before building media admin UI. Confirm required Tigris/S3-compatible env vars, local-development behavior, and the docs that tell operators how to provision the bucket and credentials.
4. **CI location cleanup:** create real workflows under `.github/workflows/`; decide whether to move or drop the existing `.github/_workflows/fly.yml`.
5. **Architecture rules cleanup:** rewrite local agent rules and docs so `app/core/*` replaces `app/services` for ecommerce domain logic.

---

## Critical files to modify or create

**Modify**
- [prisma/schema.prisma](../prisma/schema.prisma) — drop SaaS models; add catalog/cart/order/customer/plugin/setting/translation/webhook tables.
- [app/routes.js](../app/routes.js) — add `/admin/*`, `/account/*`, `/checkout/*`, `/cart`, `/products/:slug`, `/categories/:slug`, `/thank-you/:orderNumber`, `/webhooks/$provider`, and static plugin/theme dispatcher routes. (No locale URL prefix — locale resolved from cookie.)
- [app/services/stripe.server.js](../app/services/stripe.server.js) — rewrite into `app/core/payments/stripe.server.js` provider adapter.
- [app/libs/queue.server.js](../app/libs/queue.server.js) — add shop event jobs (no breaking changes).
- [app/libs/auth/index.server.js](../app/libs/auth/index.server.js) and [app/libs/auth/client.js](../app/libs/auth/client.js) — split the existing single auth setup into explicit admin and customer auth modules/clients.
- [package.json](../package.json) — drop `@polar-sh/remix`; add `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `happy-dom`, `supertest`; add test scripts.
- [.env.example](../.env.example) — add manual storage env vars and separate admin/customer auth config values.
- [.cursor/rules/general.mdc](../.cursor/rules/general.mdc), [.cursor/rules/react-router/routes.mdc](../.cursor/rules/react-router/routes.mdc), [.cursor/rules/libs-services.mdc](../.cursor/rules/libs-services.mdc), [AGENTS.md](../AGENTS.md) — rewrite guidance to make `app/core/*` the ecommerce domain layer.
- [vite.config.js](../vite.config.js) — keep React Router/Tailwind plugins and `#` alias; do not add inactive-theme tree-shaking unless runtime theme switching is removed.
- [.github/workflows/](../.github/workflows/) — create runnable PR CI for `npm run test:coverage`, `npm run lint`, and `npm run build`; current repo only has `.github/_workflows/fly.yml`.

**Create (new top-level)**
- `app/core/{catalog,cart,checkout,orders,customers,payments,shipping,tax,settings,events,plugins,themes,i18n,currency}/`
- `app/core/index.js` — public surface re-exports for themes/plugins.
- `app/core/storage/` — storage abstraction around the manually configured Tigris/S3-compatible client.
- `app/libs/auth/admin.server.js`, `app/libs/auth/customer.server.js`, `app/libs/auth/admin-client.js`, `app/libs/auth/customer-client.js` — separated auth instances and browser clients.
- `app/themes/default/` — bundled default theme.
- `app/plugins/sample-analytics/` — bundled sample plugin.
- `app/routes/admin/*`, `app/routes/storefront/*`, `app/routes/webhooks/$provider.jsx`.
- `app/test/factories/`, `app/test/helpers/`, `vitest.config.js`, `vitest-setup.js`.
- `docs/themes.md`, `docs/plugins.md`, `docs/testing.md`, `docs/auth.md`, `docs/storage.md`.

**Reuse**
- [app/libs/prisma.server.js](../app/libs/prisma.server.js) — single Prisma client.
- [app/libs/queue.server.js](../app/libs/queue.server.js) — LiteQuu for async jobs.
- [app/utils/cache.server.js](../app/utils/cache.server.js) — TTL cache for `Setting`.
- [app/utils/logger.server.js](../app/utils/logger.server.js) — Pino.
- [app/emails/job.server.js](../app/emails/job.server.js) — email queue.
- Existing better-auth setup as the starting point for `admin.server.js`; customer auth is a separate better-auth instance, not an extension of the admin instance.

---

## Verification

End-to-end manual flow on a fresh DB (after `npm run setup`):

1. Boot dev server; run a `npm run seed` script that creates 1 admin, the default theme, and the sample plugin (enabled).
2. `/admin/login` → create category, product with 2 variants, prices in USD + EUR + AUD, translations in EN + DE, media, inventory, publish.
3. Visit `/` as guest → browse to product → add to cart → 4-step checkout with Stripe test card (USD, the default).
4. Switch locale via the storefront locale switcher (writes the `locale` cookie) → confirm German strings without any URL change. Switch currency to EUR via the currency switcher (writes the `currency` cookie) → confirm EUR pricing.
5. Order confirmation email lands (Resend test mode or pino-logged).
6. Sample plugin's admin page shows the new `order.created` event from `PluginData`.
7. `/admin/themes` switch active theme → storefront re-renders with new theme without rebuild.
8. `/admin/plugins` disable sample plugin → its admin pages and product-page block disappear.
9. `/admin/orders/:id` issue refund → `Refund` row + Stripe refund + `payment.refunded` event.
10. `npm run test:coverage` passes; `app/core/**` ≥ 80%.
11. `npm run lint` clean. `npm run build` clean.

---

## Out of scope (deferred to later phases)

- Public REST API at `/api/*` (namespace reserved; design constrained to keep `app/core/*` callable from non-route entry points).
- npm-package themes & plugins (folder-based v1 covers all stated needs).
- Custom Prisma models from plugins (use `PluginData` JSON in v1).
- DB-uploaded themes (zip).
- Granular admin RBAC (admin/staff equal in v1).
- FX/auto-conversion across currencies (manual per-currency prices in v1).
- Locale URL strategies (prefix, subdomain) — cookie-only in v1.
- Carrier shipping integrations, complex tax engines (TaxJar/Avalara) — via plugins.
- Block-builder admin UI (manifest-declared blocks only).
- Inventory reservations/holds.
- Abandoned-cart automation beyond a basic email.
- Returns/RMA workflow (refunds only in v1).
