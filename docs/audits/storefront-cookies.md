# Audit: storefront cookies (parsing, flags, referral tracking)

Audit date: 2026-10-09. Split out of the [currency audit](core-currency.md) (findings C2–C4 there), whose currency-cookie work surfaced these issues. They concern cookies used by the cart, checkout, locale, currency, and loyalty referral flows, so they get their own PR and security review.

Status: **closed.** K1–K3 landed on branch `fix/storefront-cookies` (stacked on #240). Each item records its fix and how it was verified. The "Storefront cookie hardening" row in [code-quality-review.md](../code-quality-review.md) is ✅.

## Scope and file map

| File                                                                             | Cookie(s)          | Role                                             |
| -------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------ |
| [app/utils/cart-cookie.server.js](../../app/utils/cart-cookie.server.js)         | `cart_token`       | Read/build/append the cart bearer token          |
| [app/utils/checkout-cookie.server.js](../../app/utils/checkout-cookie.server.js) | `checkout_session` | Read/build/clear the checkout session id         |
| [app/core/currency/index.server.js](../../app/core/currency/index.server.js)     | `currency`         | `getRequestCurrency` reads, `setCurrencyCookie`  |
| [app/core/i18n/locales.js](../../app/core/i18n/locales.js), `index.server.js`    | `locale`           | `parseCookieLocale`, locale cookie writes        |
| [app/routes/storefront/\_layout.jsx](../../app/routes/storefront/_layout.jsx)    | `bermooda_ref`     | Referral capture + `trackReferral` on every page |
| [app/core/gdpr/index.server.js](../../app/core/gdpr/index.server.js)             | consent            | Consent preferences cookie builder               |
| [app/utils/misc.js](../../app/utils/misc.js)                                     | any                | Unused `getCookieValue`                          |

Out of scope: better-auth session cookies (configured in `#/libs/auth`), admin cookies.

## Findings

Severity: **Medium** = security or reliability risk on a real deployment · **Low** = cleanup, perf, drift risk.

### K1. Fragile, duplicated cookie parsing; a malformed cookie 500'd the storefront (Medium) — fixed

- **Where:** `getCartTokenFromRequest`, `getCheckoutSessionIdFromRequest`, `getRequestCurrency`, `parseCookieLocale`, the `bermooda_ref` regex in the storefront layout loader, and `getCookieValue` in `app/utils/misc.js`.
- **Problem:** Six hand-written parsers with different semantics. `decodeURIComponent` on a malformed `cart_token` or `bermooda_ref` (for example `%E0%A4%A`) threw `URIError`. The `bermooda_ref` parse runs in the storefront layout loader, so one bad cookie made every storefront page a 500 for that browser until the cookie expired (30 days). `getCookieValue` did a substring match and had no callers.
- **Fix (applied):** new client-safe `getCookie(header, name)` / `readCookie(request, name)` in `#/utils/cookies`: exact name match, optional quotes stripped, and a safe decode that returns `null` on bad encoding. All five callers use it (`parseCookieLocale` delegates to `getCookie`), and `getCookieValue` is deleted.
- **Check:** `app/utils/cookies/index.test.server.js` covers exact names, quotes, `=` in values, and malformed encoding. `app/routes/storefront/_layout.test.jsx` proves a malformed `bermooda_ref` no longer fails the page. The cart cookie tests cover a malformed `cart_token`.

### K2. Storefront cookies lacked `Secure`, and `cart_token` lacked `HttpOnly` (Medium, security) — fixed

- **Where:** the cart, checkout, currency, locale, and `bermooda_ref` cookie writers.
- **Problem:** `cart_token` and `checkout_session` are bearer identifiers: anyone holding them can read and change the cart and checkout. Without `Secure` they could travel over plain HTTP, and `cart_token` was readable from JavaScript, so any XSS could exfiltrate it.
- **Fix (applied):** new `serializeCookie(name, value, options)` in `#/utils/cookies/index.server` builds every storefront cookie. It adds `Secure` outside `NODE_ENV=development`, the same rule the better-auth cookies use (`buildAuthAdvancedConfig`). That replaces the `baseUrl`-based rule this doc first proposed, so storefront and auth cookies can't disagree. `cart_token`, `checkout_session`, and `bermooda_ref` are `HttpOnly`. `currency` and `locale` stay readable, since they're UI preferences, not credentials.
- **Theme check:** `bermooda/theme-default` at `3bdc0c1` has no `cookie` reference anywhere (51 files). It gets the cart through loader data, so `HttpOnly` needs no theme change. The theme also never writes the consent cookie. `buildConsentCookieValue` / `parseConsentCookie` in `core/gdpr` still have no in-repo callers and are left for plugins.
- **Check:** `app/utils/cart-cookie.test.server.js` and `checkout-cookie.test.server.js` assert the full attribute strings. The `serializeCookie` tests cover the development/production `Secure` matrix. The currency and locale cookie tests are updated.

### K3. Referral tracking ran on every storefront page view (Low, perf) — fixed

- **Where:** `routes/storefront/_layout.jsx` loader, `#/core/loyalty/index.server`.
- **Problem:** a signed-in customer carrying a `bermooda_ref` cookie (30-day max age) triggered loyalty DB work on every page for up to 30 days, and all errors were silently swallowed.
- **Fix (applied):** new `settleReferral(code, customerId)` in loyalty core. It returns `true` once the outcome is final (attributed, unknown code, or self-referral; the attribution is an idempotent upsert) and `false` after logging an unexpected error. The layout clears the cookie (`Max-Age=0`) once a referral is settled and only stores a `?ref=` code when it couldn't be settled yet (guests). `?ref` codes are normalized with `normalizeReferralCode`.
- **Check:** `settleReferral` tests in `app/core/loyalty/index.test.server.js`. Layout tests cover guest storage, clearing after settlement, and keeping the cookie for a retry.

## Work plan

Shipped as one PR, `fix(storefront): harden storefront cookies` (K1 → K2 → K3), stacked on #240 because both change the currency cookie code.

### Validation

```bash
npx vitest run app/utils app/core/currency app/core/i18n app/core/loyalty app/routes/storefront
npm run lint
```

No Prisma schema change was needed.

## Status checklist

- [x] K1 `readCookie` helper, five callers migrated, `getCookieValue` removed
- [x] K2 `serializeCookie` with `Secure`; `HttpOnly` on `cart_token`, `checkout_session`, `bermooda_ref` (theme checked)
- [x] K3 referral cookie cleared after tracking; unexpected errors logged
- [x] "Storefront cookie hardening" row in [code-quality-review.md](../code-quality-review.md) marked ✅ with a summary
