# bermooda — Phase 1 Implementation Plan

## Context

Build **bermooda**, an open-source ecommerce shop on top of the existing CursorStack template (React Router 7 SSR + Prisma 7/SQLite + better-auth + Tailwind 4 + LiteQuu + Resend + Pino + Fly.io/Tigris). Single app serves both the storefront (themed) and admin back office. Designed for extensibility: third-party developers author **themes** (folder-based React components) and **plugins** (folder-based, hook-based, JSON storage). Public REST API is reserved at `/api/*` but deferred to a later phase. v1 ships multi-currency + i18n and a Vitest test suite.

**Tenancy:** single shop per install. **Admin/staff and customers are separate user models** (no shared accounts; isolated sessions). All keep-it-simple defaults: Stripe Checkout for v1 payment, flat-rate shipping, simple-percent tax — all pluggable via the provider API. **Default currency `USD`**, also-enabled-by-default `EUR` and `AUD`. **Locale is cookie-driven, never in URLs** — every storefront URL is locale-agnostic and the active locale comes from the `locale` cookie.

---

## High-level architecture

Three surfaces in one app:
- `/` — Storefront, rendered through the active theme.
- `/admin/*` — Admin back office, core-owned UI (not themed).
- `/api/*` — Reserved namespace; not implemented in v1.

**Folder layout (additions to existing `app/`):**

```
app/
  core/                  # The shop "engine" — domain logic, no UI
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
  themes/
    default/             # bundled default theme
      manifest.js        # name, version, settings schema, links, locales
      routes.js          # storefront route contributions
      components/        # Layout, ProductCard, ProductPage, Cart, Checkout, ...
      i18n/<locale>.json # per-locale message catalogs
      assets/
  plugins/
    sample-analytics/    # bundled sample plugin, demonstrates the contract
      manifest.js
      index.server.js    # hook handlers
      admin/routes.js    # admin route contributions
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
    storefront/          # default storefront routes (theme overrides win)
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

**Layering rule:** routes call `app/core/*` services; themes only render UI; plugins extend through registered hooks/providers/blocks. Themes never import `app/core/*` directly — they consume a stable surface re-exported from `app/core/index.js`.

---

## Auth model (separate admin & customer)

- **`User`** — admin/staff only. Existing better-auth instance. Add `role: 'admin' | 'staff'`. 2FA stays default-on. Drop SaaS-era customer-style fields.
- **`Customer`** — new model + parallel better-auth tables (`CustomerSession`, `CustomerAccount`, `CustomerVerification`). Email/password + Google OAuth + email verification. 2FA optional.
- **No cross-table linkage.** Documented as intentional: a person who is both staff and customer holds two separate accounts.
- **Session isolation:** different cookie names so a staff member can be logged into both surfaces simultaneously.
- **Auth surfaces:** `/admin/login` etc. for admins; `/account/login` etc. for customers.

---

## Data model (Prisma)

**Catalog**
- `Product` — `id`, `slug` (unique per locale via `Translation`), `status` (`draft`|`active`|`archived`), `requiresShipping`, `taxClassId?`, SEO fields, timestamps. Translatable fields (`title`, `description`, `metaTitle`, `metaDescription`, `slug`) live in `Translation`.
- `ProductVariant` — `id`, `productId`, `sku` (unique), `inventoryQty`, `inventoryTracked`, `weightGrams?`, `optionValues` (JSON). **Price moved out** to `VariantPrice`.
- `VariantPrice` — `id`, `variantId`, `currency`, `priceCents`, `compareAtPriceCents?`. Unique on (`variantId`, `currency`). Lookup falls back to `defaultCurrency` if missing.
- `ProductOption`, `ProductOptionValue` — option metadata.
- `Category` — `id`, `parentId?`, `position`. Translatable fields in `Translation`.
- `ProductCategory` — join.
- `Media` — `id`, `url` (Tigris), `altText?`, `mimeType`, `width?`, `height?`. `ProductMedia` join with `position`.

**Customers**
- `Customer` — `id`, `email` (unique), `emailVerified`, `name?`, `phone?`, `marketingOptIn`, `preferredLocale?`, `preferredCurrency?`, timestamps.
- `CustomerSession`, `CustomerAccount`, `CustomerVerification` — better-auth tables (separate instance).
- `Address` — `id`, `customerId`, `type`, name/lines/city/region/postal/country/phone, `isDefault`.

**Cart & checkout**
- `Cart` — `id`, `token`, `customerId?`, `currency` (locked on first add), `locale`, `expiresAt`, timestamps.
- `CartLine` — `id`, `cartId`, `variantId`, `quantity`, `priceCentsSnapshot`, `titleSnapshot` (locale-resolved at add time).
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
- `WebhookEvent` — `id`, `provider`, `eventId` (unique), `receivedAt`. Used for webhook idempotency.

---

## Multi-currency

- Currencies enabled in `Setting.currencies` (default `['USD','EUR','AUD']`); `defaultCurrency` is `USD`.
- Per-variant prices live in `VariantPrice` rows; default-currency (USD) row required, others optional. Missing currency → fall back to default-currency price.
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
- Slugs are translatable per locale via `Translation`; the same product's URL is therefore the same string regardless of UI locale unless the admin authors a translated slug. Slug uniqueness is enforced per (locale, entityType).
- UI strings: lightweight in-house resolver in `app/core/i18n/`. Catalogs at `app/core/i18n/messages/<locale>.json`, `app/themes/<name>/i18n/<locale>.json`, `app/plugins/<name>/i18n/<locale>.json`. Plugin/theme manifests declare a `locales` array; catalogs auto-discovered.
- Theme + plugin code uses `useT()`; admin UI also runs through `useT()`. Number/currency/date formatting via `Intl`.

---

## Theme contract

A theme is a folder in `app/themes/<name>/`.

- **Manifest** — `name`, `version`, `author`, `settings` schema (rendered as a form on `/admin/themes`), `links` (assets pulled into `<head>`), `locales`.
- **Routes** — `routes.js` exports a route tree. Theme routes override core defaults in `app/routes/storefront/`. Loader stays core-owned; component is theme-owned.
- **Required components** — `Layout`, `HomePage`, `ProductCard`, `ProductGrid`, `ProductPage`, `CategoryPage`, `CartPage`, `CheckoutLayout` + step components, `CheckoutThankYouPage`, `AccountLayout` + account pages, `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `NotFoundPage`. Validated by `defineTheme()` at build time; missing components fail fast.
- **Slots** — `<Slot name="home.hero" />`, `<Slot name="product.afterDescription" />`, etc. Plugins register block components into slots via manifest. v1 ships ~10 well-known slot names; no block-builder UI in v1.
- **Data access** — themes consume loader data + `useShop()` + `useT()`. They never import `app/core/*` internals directly — only the public surface re-exported from `app/core/index.js`.
- **Active theme resolution** — `Setting.activeTheme` (TTL-cached). Switching themes requires no rebuild. A Vite plugin tree-shakes inactive themes from production bundles.
- **Hot-reload** works in dev because themes are source files.
- **Dev guide** — `docs/themes.md` covers contract, slot list, helper hooks, fork-the-default walkthrough.

---

## Plugin contract

A plugin is a folder in `app/plugins/<name>/`.

- **Manifest** — `name`, `version`, `displayName`, `description`, `settings` schema (form rendered on `/admin/plugins/<name>`), `contributes` (declarative: `adminRoutes`, `storefrontRoutes`, `blocks[]`, `paymentProviders[]`, `shippingProviders[]`, `taxProviders[]`), `locales`.
- **Server entry** — `index.server.js` exports `defineHooks({ 'order.created': fn, ... })`. Hook handlers receive `{ ...payload, ctx }` where `ctx = { db, settings, plugin: { get, set, delete }, logger, queue, emit, t }`. Plugin data flows through `ctx.plugin.*` → `PluginData` namespaced by `pluginId`.
- **Lifecycle events emitted by core (v1):** `cart.created`, `cart.updated`, `cart.itemAdded`, `cart.itemRemoved`, `checkout.started`, `checkout.completed`, `order.created`, `order.cancelled`, `order.fulfilled`, `order.refunded`, `payment.authorized`, `payment.completed`, `payment.failed`, `payment.refunded`, `customer.registered`, `customer.loggedIn`, `product.viewed`, `product.created`, `product.updated`, `product.deleted`. Hooks awaited in registration order; only checkout-critical paths propagate errors, otherwise errors are caught + logged.
- **Provider registration** — `defineProvider('payment'|'shipping'|'tax', spec)`. Built-in Stripe/flat-rate/simple-percent register via the same API (no privileged path).
- **Admin route contribution** — `app/plugins/<name>/admin/routes.js` mounted under `/admin/plugins/<name>/*`.
- **Storefront route contribution** — `app/plugins/<name>/storefront/routes.js` mounted under `/apps/<name>/*`.
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
subtotal = sum(line.unitPrice * line.qty)   # priced via VariantPrice for cart.currency
discount = applyDiscounts(subtotal, codes)
shipping = activeShippingProvider.quote(...)
tax      = activeTaxProvider.compute(subtotal - discount, shippingAddress)
total    = subtotal - discount + shipping + tax
```

Computed on every cart mutation, every checkout step, and re-run server-side at order placement. Result snapshotted onto `Order`.

**Built-in providers**
- **Payment — Stripe** (default: Stripe Checkout, hosted; Elements available). Webhook at `/webhooks/stripe` verifies signature, idempotent via `WebhookEvent.eventId`, transitions state, fires `payment.completed`/`payment.failed`.
- **Shipping — flat-rate** (per region in admin: free over X supported).
- **Tax — simple-percent** (per country/region; tax-inclusive vs exclusive shop-wide setting).

**Inventory** — atomic decrement at order creation; `inventoryTracked=false` skipped; `INSUFFICIENT_INVENTORY` failure sends customer back to cart. No reservations in v1.

**Refunds** — admin "Refund" button (full or partial) routes through provider's `refund()`; `Refund` row recorded; `payment.refunded` fires.

**Webhook receiver** — `routes/webhooks/$provider.jsx` resolves provider from registry and calls `verifyWebhook()`. Plugin payment providers ship their webhooks without registering routes.

---

## Admin back office

`/admin/*` is built once in core (Tailwind + Headless UI, both already in repo). Not themed.

- **Sidebar:** Dashboard, Orders, Products, Categories, Customers, Discounts, Themes, Plugins, Settings.
- **Topbar:** search, current admin user, theme/dark-mode toggle, **locale switcher** (admin UI runs through `useT()`).
- **Pages:**
  - **Dashboard** — KPI tiles + recent orders + plugin-contributed widgets via `dashboard.widgets` slot.
  - **Orders** — list/filter, detail (line items, payment events, fulfillment, refund, manual notes).
  - **Products** — list + create/edit (translatable fields with locale tabs, options, variants editor, **per-currency price grid**, media uploader to Tigris, categories, SEO).
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
- CI: extend `.github/workflows/` to run `npm run test:coverage` on PRs.

**Coverage targets (v1 must-haves):**
1. **Totals engine** — subtotal, discount, shipping, tax, multi-currency price resolution + fallback, tax-inclusive vs exclusive, edge cases.
2. **Cart service** — add/remove/update line, currency lock on first add, snapshot pricing, expiry, guest→customer cart merge on login.
3. **Checkout pipeline** — step transitions, validation, server-side recompute, idempotent order creation, inventory decrement (incl. INSUFFICIENT_INVENTORY race-loss).
4. **Order service** — create from checkout, status transitions, refund flow, fulfillment.
5. **Plugin loader** — manifest validation, hook registration, dispatch order, error isolation, `ctx.plugin.*` namespacing, enable/disable lifecycle.
6. **Theme resolver** — active resolution, manifest validation, route override precedence, fallback to core defaults, missing-component fail-fast.
7. **Provider registry** — register/lookup, no-privileged-path-for-built-ins assertion, `defineProvider` validation.
8. **i18n resolver** — locale resolution chain, fallback, missing-key behavior, plugin/theme catalog merging.
9. **Translation service** — read with fallback, write per locale, slug uniqueness per locale.
10. **Currency service** — active currency resolution, `VariantPrice` lookup with fallback, `Intl` formatting per locale.
11. **Stripe payment adapter** — `startPayment` shape, webhook signature verification (mocked), idempotent replay, refund flow.
12. **Webhook idempotency** — `WebhookEvent` replay-skip behavior.
13. **Discount engine** — percent vs fixed, min subtotal, expiry, max-uses.
14. **Inventory** — atomic decrement, race condition, `inventoryTracked=false` skip.
15. **Auth boundaries** — `requireAdmin()` redirect, customer-vs-admin session isolation, guest cart token rotation on login.
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
- [app/services/stripe.server.js](../app/services/stripe.server.js) — **rewrite** (not just move) into `app/core/payments/stripe.js`: drop the subscription `checkout.session` helper and `customer.subscription.*` event handling; keep only one-time-payment Stripe Checkout + signature verification.
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

**Polish (drive-bys with the same first commit)**
- [app/utils/logger.server.js](../app/utils/logger.server.js) — change the default Pino `name` from the stale `easyedit-order-editing` to `bermooda`.
- [README.md](../README.md) — fix the dev URL from `http://localhost:5173` to `http://localhost:3000`.

**Kept:** better-auth, Resend + React Email, LiteQuu, Pino, `@isaacs/ttlcache` (used for the `Setting` cache via [app/utils/cache.server.js](../app/utils/cache.server.js)), Telegram, Tailwind, Headless UI, Heroicons, oxlint/oxfmt, LiteFS, Tigris setup, `fly.toml`.

---

## Critical files to modify or create

**Modify**
- [prisma/schema.prisma](../prisma/schema.prisma) — drop SaaS models; add catalog/cart/order/customer/plugin/setting/translation/webhook tables.
- [app/routes.js](../app/routes.js) — add `/admin/*`, `/account/*`, `/checkout/*`, `/cart`, `/products/:slug`, `/categories/:slug`, `/thank-you/:orderNumber`, `/webhooks/$provider`, theme-route merge. (No locale URL prefix — locale resolved from cookie.)
- [app/services/stripe.server.js](../app/services/stripe.server.js) — refactor into `app/core/payments/stripe.js` provider adapter.
- [app/libs/queue.server.js](../app/libs/queue.server.js) — add shop event jobs (no breaking changes).
- [package.json](../package.json) — drop `@polar-sh/remix`; add `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `happy-dom`, `supertest`; add test scripts.
- [vite.config.js](../vite.config.js) — add Vite plugin to tree-shake inactive themes.
- [.github/workflows/](../.github/workflows/) — run `npm run test:coverage` on PRs.

**Create (new top-level)**
- `app/core/{catalog,cart,checkout,orders,customers,payments,shipping,tax,settings,events,plugins,themes,i18n,currency}/`
- `app/core/index.js` — public surface re-exports for themes/plugins.
- `app/themes/default/` — bundled default theme.
- `app/plugins/sample-analytics/` — bundled sample plugin.
- `app/routes/admin/*`, `app/routes/storefront/*`, `app/routes/webhooks/$provider.jsx`.
- `app/test/factories/`, `app/test/helpers/`, `vitest.config.js`, `vitest-setup.js`.
- `docs/themes.md`, `docs/plugins.md`, `docs/testing.md`.

**Reuse**
- [app/libs/prisma.server.js](../app/libs/prisma.server.js) — single Prisma client.
- [app/libs/queue.server.js](../app/libs/queue.server.js) — LiteQuu for async jobs.
- [app/utils/cache.server.js](../app/utils/cache.server.js) — TTL cache for `Setting`.
- [app/utils/logger.server.js](../app/utils/logger.server.js) — Pino.
- [app/emails/job.server.js](../app/emails/job.server.js) — email queue.
- Existing better-auth setup as the pattern for the parallel Customer auth instance.

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
