# Audit: `app/core/currency/` (request currency, money formatting, provider amounts)

Audit date: 2026-10-09. Baseline commit: `ad82a38` (bermooda 0.11.1).

Status: **closed.** Every finding below landed in PR #240 (branch `fix/currency-audit`). Each item records its fix and how it was verified. The `currency/` row in [code-quality-review.md](../code-quality-review.md) is ✅. The cookie findings first logged here as C2–C4 moved to their own audit, [storefront-cookies.md](storefront-cookies.md) (K1–K3).

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

### M2. The money model let merchants enter fractional yen and showed "¥1,000.00" (Medium) — fixed

- **Where:** `parseVariantPriceFormData` in `core/catalog/admin-product-form.server.js`, the price grid in `components/admin/product-editor.jsx`, `getIssueGiftCardInputError` in `core/gift-cards/index.server.js`, `parseDiscountFormData` in `core/discounts/index.server.js`, JSON-LD `price` in `core/seo/index.server.js`, `formatValue` in `routes/admin/discounts/index.jsx`, and `formatPrice`.
- **Problem:** Everything is stored as 1/100 of the major unit, so a merchant could enter `¥10.50`. M1's conversion rounds that to ¥11 at Stripe, and the captured amount then no longer equals `order.totalCents`. Yen displayed as "¥1,000.00", and JSON-LD always had two decimals.
- **Decision:** option (a). Keep the 1/100 storage model, enforce each currency's precision at input, and display amounts at the currency's own precision. No data migration was needed. Option (b), true ISO minor units, was rejected because it needs a data migration and changes every `* 100` / `/ 100` site.
- **Fix (applied):**
  - New helpers in `#/core/currency/format`: `centsPerMinorUnit` (JPY 100), `roundCentsToCurrency`, `isCentsAtCurrencyPrecision`, `currencyInputStep`, `centsToInputValue`. `currencyFractionDigits` results are now cached.
  - Product prices: inputs use `step="1"` for JPY. Server-side, the parser rounds to the currency's precision (¥1000.5 → ¥1001) and ignores field names with malformed currency codes, which `Intl` would otherwise reject. The parsing is extracted as `parseVariantPriceFormData` and covered by new tests.
  - Gift cards: `getIssueGiftCardInputError` checks for a positive balance, a 3-letter currency, and whole-unit amounts. The admin form, the admin API, and `issueGiftCard` all use it.
  - Fixed discounts: the currency is uppercased (before, `usd` never matched a `USD` cart) and validated, and the value must be a whole amount in that currency.
  - Display: `formatPrice` uses the currency's default precision (`¥1,000`, `$19.99`, `KWD 12.340`). JSON-LD uses `centsToMajorUnitString`. The admin discount list formats values with `formatPrice`.
- **Gift-card input:** the admin gift-card balance used to be typed in cents. C7 turned it into a decimal input whose `step` follows the selected currency.

### M3. Switching currency with items in the cart broke "add to cart", and carts in a disabled currency still checked out (Medium) — fixed

- **Where:** `setCartCurrency` in `core/cart/index.server.js`, the add action in `routes/storefront/cart/index.jsx`, `routes/storefront/api/set-currency/index.jsx`, `placeOrder` in `core/orders/place.server.js`, `loadCheckoutDisplayData` in `core/checkout/storefront.server.js`, and the place-order catch in `routes/storefront/checkout/index.jsx`.
- **Problem:** A cart is locked to the currency it was created in. After the shopper picked another currency, every add returned the raw string `'Currency mismatch'` until the 30-day cart cookie expired. A cart created before the merchant disabled its currency still checked out in that currency, and checkout labeled the totals (computed in the cart's currency) with the request currency.
- **Fix (applied):**
  - New `setCartCurrency(cartId, currency)` reprices every line through `resolveVariantPrice` and switches the cart's currency in one transaction. It's all-or-nothing: if any line has no price in the new currency, it throws `PRICE_NOT_FOUND` and leaves the cart unchanged.
  - The currency switcher reprices the shopper's cart when they pick a currency. Repricing never blocks saving the preference: a missing price keeps the cart's currency, and unexpected errors go through `handleError` for logging and alerting.
  - Add-to-cart reprices a cart that's in a different currency than the request (for example after a cookie expired or the merchant disabled a currency). If items have no price there, it explains which currency to switch back to.
  - `placeOrder` throws `CART_CURRENCY_DISABLED` before the transaction when the cart's currency isn't enabled. The checkout route maps that to a clear message instead of the generic "payment setup failed".
  - Checkout display data and the cart page loader label amounts with the cart's currency, since line prices are snapshots in it.
- **Note:** storefront route error strings in this repo are plain English (the theme owns translation). These messages follow that convention.
- **Check:** `npx vitest run app/core/cart app/core/orders app/core/checkout app/routes/storefront`.

### M4. Sales-channel currency was ignored (Medium) — fixed

- **Where:** `getRequestCurrency`, `resolveChannelFromRequest`.
- **Problem:** `SalesChannel.currency` exists and channels are resolved per domain, but currency resolution never used it. A shop with `shop.example.de → EUR` still defaulted to the shop-wide `defaultCurrency`.
- **Decision:** cookie → channel currency → `defaultCurrency`, where each step applies only if that currency is enabled. **The default channel defers to `defaultCurrency`.** It's seeded with a hard-coded `currency: 'USD'`, and merchants change the shop currency in settings, not on the channel. Letting it win would have switched every non-USD shop back to USD.
- **Fix (applied):** `getRequestCurrency` resolves the channel itself, so the layout, page context, cart, and checkout all agree. `resolveChannelFromRequest` is memoized per `Request` with a `WeakMap`. Layout and route loaders share a request, so the extra lookup costs no query, and nothing is cached across requests, so admin channel edits apply immediately.
- **Check:** `npx vitest run app/core/currency app/core/channels` covers channel vs cookie vs default precedence, a disabled channel currency, and the one-query-per-request memo.

### C1. Currency cookie wasn't checked against enabled currencies (Medium, integrity) — fixed

- **Where:** `getRequestCurrency`.
- **Problem:** Any well-formed 3-letter cookie (`currency=JPY`) was trusted. The value flows into `createCart`, so a shopper could buy in a currency the merchant had disabled but that still had `VariantPrice` rows (for example, stale prices left after turning a currency off).
- **Fix (applied):** the cookie is used only when it's in `getEnabledCurrencies()` (cached settings read). Otherwise resolution falls back to the default. The settings key now comes from `SETTING_KEYS.DEFAULT_CURRENCY` rather than a string literal.

### Q1. Dead code (Low) — fixed

- Removed `lookupVariantPrice` and `lookupVariantPriceForBrowsing`, which had no callers because pricing goes through `#/core/pricing`, along with their tests.
- Removed the "backward compat" `formatPrice` re-export from `index.server.js`. Every caller already imports `#/core/currency/format` or `#/core`.
- Removed the unreachable `?? channel.currency ?? 'USD'` in the storefront layout, since `getRequestCurrency` always returns a string. M4 moved channel currency into `getRequestCurrency`.

### Q2. Six duplicate money formatters (Low) — fixed

- `fmt` in three shop emails, `formatCents` in `core/documents`, `formatQuoteMoney` in `core/b2b`, and `formatMoney` in the admin gift-card list all reimplemented `Intl.NumberFormat(...).format(cents / 100)`. They all now use `formatPrice`, and their exports and tests were removed.
- Emails were hard-coded to `'en'` number formatting even when the template was localized. They now format with the email's `locale` (German orders show `19,99 €`).

### P1. A new `Intl.NumberFormat` per formatted amount (Low, perf) — fixed

- `formatPrice` now caches one formatter per `locale|currency`. Admin order lists, the order detail page, and emails format dozens of amounts per render.

### C2–C4. Storefront cookie findings — moved

Cookie parsing, `Secure`/`HttpOnly` flags, and referral tracking aren't currency work. They touch the cart, checkout, locale, consent, and loyalty cookies and deserve their own security review, so they're tracked in [storefront-cookies.md](storefront-cookies.md) as K1 (was C2), K2 (was C3), and K3 (was C4).

### C5. `formatPrice` threw on bad input (Low) — fixed

- **Where:** `formatPrice` in `format.js`.
- **Problem:** `Intl.NumberFormat` throws `RangeError` for a `null` or malformed currency and for an invalid locale tag. One bad row (`Discount.currency` is nullable, and older rows weren't validated) took down a whole admin page or email render.
- **Fix (applied):** on error, `formatPrice` retries with the `en` locale, then falls back to a plain decimal (`19.99 EURO`). There's no logging, because the file is client-safe. The admin discount list dropped its own regex guard and relies on this.
- **Check:** `formatPrice` tests for `null`, `'EURO'`, and an invalid locale.

### C6. Admin money formatting ignored the admin locale and some currencies (Low) — fixed

- **Where:** admin orders (list and detail), customer detail, dashboard, reports, gift cards, and the discount list.
- **Problem:** every admin amount used the default `'en'` locale. Store credit on the customer page and dashboard revenue were formatted without a currency, so they always showed USD.
- **Fix (applied):** `I18nContext` now carries `locale`; the admin, public admin, and storefront layouts provide it. `useLocale()` in `#/core/i18n` reads it, and `useFormatPrice()` in `#/hooks/use-format-price` binds it to `formatPrice`. Every admin page above uses the hook. Store credit and dashboard revenue are labeled with the shop's `defaultCurrency`, since store-credit ledgers have no currency of their own.
- **Not fixed here (reporting/store-credit, recorded in the tracker's later-pass table):** dashboard and report revenue sum orders across currencies, and store credit is redeemed cent-for-cent against carts in any currency.

### C7. Gift-card balance was entered in cents (Low, UX) — fixed

- **Where:** `components/admin/gift-card-editor.jsx`, `routes/admin/gift-cards/new.jsx`, `parseDecimalToCents` in `format.js`.
- **Problem:** merchants typed `2500` for $25 and `100000` for ¥1,000, and the currency was a free-text field.
- **Fix (applied):** the form takes a decimal `balance` ("25.50"), converted with the new shared `parseDecimalToCents`, which the product price parser now uses too. The currency is a select of the shop's enabled currencies (loaded by a new route loader, defaulting to `defaultCurrency`), and the amount input's `step`/`min` follow the selected currency. Sub-unit yen still gets the clear validation message. The admin API keeps accepting `balanceCents`. Labels in en/de/fr no longer say "cents".
- **Check:** `app/routes/admin/gift-cards/new.test.jsx` covers the loader, decimal conversion, sub-unit rejection, and a missing balance.

### T1. Test gaps (Low) — fixed

- PayPal: `app/core/payments/paypal/index.test.server.js` stubs env and `fetch`, re-imports the module, and asserts JPY orders send `value: '1000'` and USD refunds send `'19.99'`.
- Checkout route: `app/routes/storefront/checkout/index.test.jsx` covers the `CART_CURRENCY_DISABLED` message and the `handleError` path for other place-order failures.

### D1. Undocumented money model and currency resolution (Low) — fixed

- [docs/themes.md](../themes.md#prices-and-currency) has a new **Prices and currency** section covering the cents model, precision rules, `formatPrice` and `useFormatPrice`, the currency resolution order, and how carts follow a currency switch. [app/emails/README.md](../../app/emails/README.md) points templates at `formatPrice` with the email locale. [docs/phase-1-plan.md](../phase-1-plan.md) still describes the removed `lookupVariantPrice*` helpers. It's a historical plan, so it stays as is.

### Hygiene

- `queue.db` (written to the repo root by queue-backed tests) is now in `.gitignore`.

## Work plan

All of it shipped in one PR, #240 (`feat(currency): …`), across these commits: provider amounts and cookie validation (M1, C1, Q1, Q2, P1), precision and channel currency (M2, M4), cart currency switching (M3), and the rest (C5–C7, T1, D1).

### Validation

```bash
npx vitest run app/core/currency app/core/payments app/core/cart app/core/checkout app/core/orders app/routes/storefront app/routes/admin app/emails
npm run lint
```

No Prisma schema change was needed. M2 went with option (a), so there's no data migration.

## Status checklist

- [x] M1 provider minor-unit conversion (Stripe checkout/intent/refund, PayPal order/refund)
- [x] M2 currency precision in admin inputs + display (option (a))
- [x] M3 cart currency switch + disabled-currency checkout guard
- [x] M4 channel currency precedence (cookie → non-default channel → `defaultCurrency`)
- [x] C1 cookie validated against enabled currencies
- [x] C2–C4 moved to [storefront-cookies.md](storefront-cookies.md) (K1–K3)
- [x] C5 `formatPrice` survives bad input
- [x] C6 admin locale + store-credit currency
- [x] C7 gift-card balance as a decimal input
- [x] Q1 dead code removed
- [x] Q2 duplicate formatters consolidated; emails use their locale
- [x] P1 formatter cache
- [x] T1 PayPal amount tests + checkout route tests
- [x] D1 docs
- [x] `currency/` row in [code-quality-review.md](../code-quality-review.md) marked ✅ with a summary
