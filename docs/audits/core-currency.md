# Audit: `app/core/currency/` (request currency, money formatting, provider amounts)

Audit date: 2026-10-09. Baseline commit: `ad82a38` (bermooda 0.11.1).

This doc is a work queue for later sessions. Each finding has an ID, a severity, the exact location, what is wrong, the fix, and how to check it. Work through the **Work plan** at the end in order, tick the checklist, and update the `currency/` row in [code-quality-review.md](../code-quality-review.md) when everything is closed. Follow the agent rules at the top of that tracker: no follow-up placeholders, trace every caller before removing an export, and fix completely in the same change.

## Why this area

`currency/` was one of the areas the code-quality tracker didn't cover yet (`bootstrap/`, `currency/`, `app/emails`, `app/hooks`, `app/utils`); it was picked at random from that list. The module itself is small (two files), but it decides which currency a cart and order are created in and how every amount is shown. Following those values into payments turned up the most serious finding: zero-decimal currencies were charged at 100× the price.

## Scope and file map

| File                                                                                                                                                     | Role                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [app/core/currency/index.server.js](../../app/core/currency/index.server.js)                                                                             | `getRequestCurrency` (cookie → default setting), `setCurrencyCookie`                               |
| [app/core/currency/format.js](../../app/core/currency/format.js)                                                                                         | Client-safe `formatPrice`, `currencyFractionDigits`, `centsToMinorUnits`, `centsToMajorUnitString` |
| [app/core/currency/index.test.server.js](../../app/core/currency/index.test.server.js)                                                                   | Unit tests                                                                                         |
| [app/routes/storefront/api/set-currency/index.jsx](../../app/routes/storefront/api/set-currency/index.jsx)                                               | Currency switcher; validates against enabled currencies                                            |
| [app/routes/storefront/\_layout.jsx](../../app/routes/storefront/_layout.jsx)                                                                            | Layout loader; resolves channel + request currency                                                 |
| [app/core/storefront/page-context.server.js](../../app/core/storefront/page-context.server.js)                                                           | Per-page `{ locale, currency }` for storefront loaders/actions                                     |
| [app/routes/storefront/cart/index.jsx](../../app/routes/storefront/cart/index.jsx)                                                                       | Creates the cart in the request currency; `addLine` enforces the cart's currency lock              |
| [app/core/payments/stripe.server.js](../../app/core/payments/stripe.server.js), [paypal/index.server.js](../../app/core/payments/paypal/index.server.js) | Convert stored cents to provider amounts                                                           |
| [app/core/settings/defaults.js](../../app/core/settings/defaults.js)                                                                                     | `AVAILABLE_CURRENCIES` (includes `JPY`), `DEFAULT_CURRENCIES`                                      |

Out of scope: price-list resolution (`app/core/pricing/`), tax rounding, and the storefront theme (separate repo, `@bermooda/theme-default`) except where noted.

## Money model (read this first)

All amounts are stored as integer **cents = 1/100 of the currency's major unit, for every currency**. The admin product form multiplies the entered decimal by 100 (`app/core/catalog/admin-product-form.server.js:285`) and displays `cents / 100` with two decimals (`app/components/admin/product-editor.jsx:296`). So ¥1,000 is stored as `100000`. Payment providers use ISO 4217 minor units instead (JPY has 0 decimals, KWD has 3), so every provider call must convert. `centsToMinorUnits` / `centsToMajorUnitString` in `#/core/currency/format` do that.

## Findings

Severity: **High** = money or security risk on a real deployment · **Medium** = wrong behavior in realistic cases · **Low** = cleanup, drift risk, docs.

### M1. Stripe charged zero-decimal currencies 100× the price; PayPal sent invalid JPY amounts (High) — fixed

- **Where:** `buildStripeLineItems`, `createPaymentIntent`, `createRefund` in `stripe.server.js`; `centsToMajorUnit` in `paypal/index.server.js`.
- **Problem:** `JPY` is in `AVAILABLE_CURRENCIES`, so merchants can enable it from the admin. A ¥1,000 product is stored as `100000`. Stripe's `unit_amount` for JPY is in yen, so checkout charged ¥100,000. Refunds had the same 100× factor. PayPal got `"1000.00"`, but JPY doesn't allow decimals there, so the order create call fails.
- **Fix (applied):** added `currencyFractionDigits`, `centsToMinorUnits`, and `centsToMajorUnitString` to `#/core/currency/format`. Stripe converts every amount (checkout, PaymentIntent, refund, which already received `order.currency` from `#/core/orders/refunds.server`). For currencies that don't use 2 decimals, Stripe always charges one "Order total" line, so rounding each line can't drift from the total. PayPal formats with the currency's own precision.
- **Check:** `npx vitest run app/core/currency app/core/payments`, which covers JPY checkout (2 × ¥1,000 → `unit_amount: 2000`), JPY refund, and KWD conversion.

### M2. The money model lets you enter fractional yen and shows "¥1,000.00" (Medium) — open

- **Where:** `admin-product-form.server.js:285,297`, `product-editor.jsx:296`, `gift-card-editor.jsx`, `routes/admin/discounts/index.jsx:125`, `core/seo/index.server.js:517` (JSON-LD `price`), and `formatPrice` (`minimumFractionDigits: 2`).
- **Problem:** Because everything is stored as 1/100 major unit, a merchant can enter `¥10.50`. M1's conversion rounds that to ¥11 at Stripe, so the captured amount no longer equals `order.totalCents`. The storefront, emails, and PDFs show "¥1,000.00", which is unusual for yen. JSON-LD always emits two decimals.
- **Decide first (ask the user):** (a) keep the 1/100 model, but make admin inputs reject sub-unit precision (`step` from `currencyFractionDigits`, server-side validation in the product, gift-card, and discount parsers) and show amounts at the currency's own precision; or (b) migrate to true ISO minor units, which needs a data migration for existing non-2-decimal rows and a change to every `* 100` / `/ 100` site. **(a) is recommended:** it's smaller, has no data migration, and M1 already handles providers.
- **Done when:** a JPY product can't be saved with a fractional price (core parser test), and `formatPrice(100000, 'JPY')` renders `¥1,000` (update the `formatPrice` test and drop `minimumFractionDigits: 2` only once fractional input is impossible).

### M3. Switching currency with a non-empty cart breaks "add to cart", and carts in a disabled currency still check out (Medium) — open

- **Where:** `routes/storefront/cart/index.jsx` (`intent === 'add'`), `addLine` in `core/cart/index.server.js:152-154`, checkout placement in `core/orders/place.server.js`.
- **Problem:** The cart is locked to the currency it was created in. After the shopper picks another currency, every add returns the raw, untranslated string `'Currency mismatch'` until the 30-day cart cookie expires. Separately, a cart created before the merchant disabled its currency still checks out in that currency. C1 only protects new carts.
- **Fix:** In the cart action, if the cart is empty, update `cart.currency` to the request currency. If it isn't empty, reprice its lines with `resolveVariantPrice` in the new currency (or reject with a translated `cart.currencyMismatch` message that offers a reset). In order placement, reject `cart.currency` values that aren't in `getEnabledCurrencies()` and map that to a checkout error.
- **Done when:** route tests cover empty-cart currency switch, non-empty switch, and place-order refusal for a disabled currency.

### M4. Sales-channel currency is ignored (Medium, needs a decision) — open

- **Where:** `getRequestCurrency`; the layout used to have an unreachable `?? channel.currency` fallback, removed in this pass.
- **Problem:** `SalesChannel.currency` exists and channels are resolved per domain, but currency resolution never uses it. A shop with `shop.example.de → EUR` still defaults to the shop-wide `defaultCurrency`.
- **Decide first:** precedence. Recommended: cookie (if enabled) → active channel's currency (if enabled) → `defaultCurrency`. Implement it inside `getRequestCurrency` so the layout, page context, cart, and checkout all agree. They call it separately today. Note that `resolveChannelFromRequest` queries the DB on every call without caching, so cache it with `getCachedResult` keyed by host if it ends up on every storefront request.

### C1. Currency cookie wasn't checked against enabled currencies (Medium, integrity) — fixed

- **Where:** `getRequestCurrency`.
- **Problem:** Any well-formed 3-letter cookie (`currency=JPY`) was trusted. The value flows into `createCart`, so a shopper could buy in a currency the merchant had disabled but that still had `VariantPrice` rows (for example, stale prices left after turning a currency off).
- **Fix (applied):** the cookie is used only when it's in `getEnabledCurrencies()` (cached settings read). Otherwise resolution falls back to the default. The settings key now comes from `SETTING_KEYS.DEFAULT_CURRENCY` rather than a string literal.

### Q1. Dead code (Low) — fixed

- Removed `lookupVariantPrice` and `lookupVariantPriceForBrowsing`, which had no callers because pricing goes through `#/core/pricing`, along with their tests.
- Removed the "backward compat" `formatPrice` re-export from `index.server.js`. Every caller already imports `#/core/currency/format` or `#/core`.
- Removed the unreachable `?? channel.currency ?? 'USD'` in the storefront layout, since `getRequestCurrency` always returns a string. See M4.

### Q2. Six duplicate money formatters (Low) — fixed

- `fmt` in three shop emails, `formatCents` in `core/documents`, `formatQuoteMoney` in `core/b2b`, and `formatMoney` in the admin gift-card list all reimplemented `Intl.NumberFormat(...).format(cents / 100)`. They all now use `formatPrice`, and their exports and tests were removed.
- Emails were hard-coded to `'en'` number formatting even when the template was localized. They now format with the email's `locale` (German orders show `19,99 €`).

### P1. A new `Intl.NumberFormat` per formatted amount (Low, perf) — fixed

- `formatPrice` now caches one formatter per `locale|currency`. Admin order lists, the order detail page, and emails format dozens of amounts per render.

### C2. Fragile, duplicated cookie parsing (Low) — open

- **Where:** `getRequestCurrency`, `app/utils/cart-cookie.server.js`, `app/utils/checkout-cookie.server.js`, `routes/storefront/_layout.jsx` (`bermooda_ref`), `core/i18n` (`parseCookieLocale`), and the unused `getCookieValue` in `app/utils/misc.js`.
- **Problem:** Six regex parsers with different semantics. `decodeURIComponent` on a malformed `cart_token` or `bermooda_ref` throws `URIError`, which turns every storefront page into a 500 for that browser. `getCookieValue` does a substring match (`xcart_token=` matches `cart_token`) and has no callers.
- **Fix:** Add one `readCookie(request, name)` in `#/utils/cookies` (exact name match, safe decode that returns `null` on failure), migrate all six callers, and delete `getCookieValue`. Unit-test the malformed-encoding case.

### C3. Storefront cookies lack `Secure` in production (Low, security) — open

- **Where:** `setCurrencyCookie`, `buildCartTokenCookie`, `buildCheckoutSessionCookie`, the `bermooda_ref` cookie in the layout.
- **Problem:** `cart_token` and `checkout_session` are bearer identifiers for the cart and checkout. Without `Secure` they can be sent over plain HTTP if a request is ever downgraded.
- **Fix:** Build all four through the C2 helper and add `Secure` when `config.baseUrl` is `https:` (or `NODE_ENV === 'production'`). Add `HttpOnly` to `cart_token` if the theme doesn't read it client-side (check theme-default first).

### C4. Referral tracking runs on every storefront page view (Low, perf, adjacent) — open

- **Where:** `routes/storefront/_layout.jsx` loader → `trackReferral`.
- **Problem:** A logged-in customer carrying a `bermooda_ref` cookie (30-day max age) triggers loyalty DB work on every page for up to 30 days. Errors are silently swallowed.
- **Fix:** After a successful (or permanently failed) `trackReferral`, clear the cookie with `Max-Age=0`. Log unexpected errors via `#/utils/logger.server` instead of discarding them.

### C5. `formatPrice` throws on bad input (Low) — open

- **Where:** `format.js`.
- **Problem:** `Intl.NumberFormat` throws `RangeError` for `null` or invalid currency codes and for invalid locale tags. One bad row (for example `Discount.currency` is nullable) takes down the whole admin page or email render.
- **Fix:** Catch the `RangeError` in `formatPrice` and fall back to plain decimal formatting (`` `${(cents / 100).toFixed(2)} ${currency ?? ''}`.trim() ``). Don't log there, because the file is client-safe. Add tests.

### C6. Admin money formatting ignores the admin locale and some currencies (Low) — open

- **Where:** admin routes call `formatPrice(x, currency)` with the default `'en'` locale. `routes/admin/customers/$id.jsx:502` formats store credit with no currency, so it always shows USD.
- **Fix:** Pass the admin UI locale from the loader. Resolve the store-credit currency (shop default currency, or a per-ledger currency if the model adds one).

### T1. Test gaps (Low) — open

- PayPal JPY payload: the module reads credentials at import, so use `vi.stubEnv` + `vi.resetModules` and assert `value: '1000'`.
- M3 route tests and C2 cookie-helper tests, as listed above.

### D1. Undocumented money model and currency resolution (Low) — open

- Document the M2 decision, the cents model, and the currency resolution order (C1/M4) in [docs/themes.md](../themes.md) (themes format prices) and [app/emails/README.md](../../app/emails/README.md) (use `formatPrice` with the email locale). [docs/phase-1-plan.md](../phase-1-plan.md) still describes the removed `lookupVariantPrice*` helpers. It's a historical plan, so leave it, but don't link it as current docs.

## Work plan

Suggested PR split (Conventional Commit titles, per AGENTS.md). Each PR must pass the validation below.

1. **`fix(currency): charge zero-decimal currencies correctly and validate the currency cookie`**: M1, C1, Q1, Q2, P1. **Done in this pass.**
2. **`fix(cart): handle currency switches and disabled cart currencies`**: M3, plus the T1 route tests.
3. **`feat(currency): honor sales-channel currency`**: M4 (ask the user about precedence first).
4. **`fix(currency): enforce currency precision in admin money inputs`**: M2 (ask the user about option (a)/(b) first), C5, C6, D1.
5. **`fix(storefront): shared cookie helper with Secure flag`**: C2, C3, C4.

### Validation

```bash
npx vitest run app/core/currency app/core/payments app/core/cart app/core/checkout app/routes/storefront app/emails
npm run lint
```

No Prisma schema change is needed for M1–M4 or C1–C6. If M2 goes with option (b), it needs a data migration: follow the Prisma steps in CLAUDE.md.

## Status checklist

- [x] M1 provider minor-unit conversion (Stripe checkout/intent/refund, PayPal order/refund)
- [ ] M2 currency precision in admin inputs + display (decision needed)
- [ ] M3 cart currency switch + disabled-currency checkout guard
- [ ] M4 channel currency precedence (decision needed)
- [x] C1 cookie validated against enabled currencies
- [ ] C2 shared cookie helper, `getCookieValue` removed
- [ ] C3 `Secure` storefront cookies
- [ ] C4 referral cookie cleared after tracking
- [ ] C5 `formatPrice` survives bad input
- [ ] C6 admin locale + store-credit currency
- [x] Q1 dead code removed
- [x] Q2 duplicate formatters consolidated; emails use their locale
- [x] P1 formatter cache
- [ ] T1 PayPal JPY test (M3/C2 tests ship with those items)
- [ ] D1 docs
- [ ] `currency/` row in [code-quality-review.md](../code-quality-review.md) marked ✅ with a summary
