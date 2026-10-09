# Audit: storefront cookies (parsing, flags, referral tracking)

Audit date: 2026-10-09. Split out of the [currency audit](core-currency.md) (findings C2–C4 there), whose currency-cookie work surfaced these issues. They concern cookies used by the cart, checkout, locale, currency, and loyalty referral flows, so they get their own PR and security review.

This doc is a work queue for later sessions. Each finding has an ID, a severity, the exact location, what is wrong, the fix, and how to check it. Work through the **Work plan** in order, tick the checklist, and update the "Storefront cookie hardening" row in [code-quality-review.md](../code-quality-review.md) when everything is closed. Follow the agent rules at the top of that tracker.

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

### K1. Fragile, duplicated cookie parsing; a malformed cookie 500s the storefront (Medium) — open

- **Where:** `getCartTokenFromRequest`, `getCheckoutSessionIdFromRequest`, `getRequestCurrency`, `parseCookieLocale`, the `bermooda_ref` regex in the storefront layout loader, and `getCookieValue` in `app/utils/misc.js`.
- **Problem:** Six hand-written parsers with different semantics. `decodeURIComponent` on a malformed `cart_token` or `bermooda_ref` (for example `%E0%A4%A`) throws `URIError`. The `bermooda_ref` parse runs in the storefront layout loader, so one bad cookie turns every storefront page into a 500 for that browser until the cookie expires (30 days). `getCookieValue` does a substring match (`xcart_token=` matches `cart_token`) and has no callers.
- **Fix:** Add one `readCookie(request, name)` in `#/utils/cookies` with an exact name match and a safe decode that returns `null` on failure. Migrate all five callers and delete `getCookieValue`.
- **Done when:** unit tests cover exact-name matching, quoted values, and a malformed encoding (returns `null`, doesn't throw), and a layout loader test proves a malformed `bermooda_ref` doesn't fail the page.

### K2. Storefront cookies lack `Secure` (and `cart_token` lacks `HttpOnly`) (Medium, security) — open

- **Where:** `buildCartTokenCookie`, `buildCheckoutSessionCookie`, `clearCheckoutSessionCookie`, `setCurrencyCookie`, the locale cookie write (`core/i18n/index.server.js`), the consent cookie value builder (`buildConsentCookieValue` in `core/gdpr/index.server.js`, no in-repo callers: check whether theme-default writes that cookie and with which flags), and the `bermooda_ref` write in the storefront layout.
- **Problem:** `cart_token` and `checkout_session` are bearer identifiers. Anyone holding them can read and change the cart and checkout (address, email). Without `Secure`, they can be sent over plain HTTP if a request is ever downgraded. `cart_token` is also readable from JavaScript, so any XSS can exfiltrate it.
- **Fix:** Add a `serializeCookie(name, value, options)` helper next to K1's `readCookie`, and build every storefront cookie through it. Add `Secure` when `config.baseUrl` is `https:` (not by `NODE_ENV`, so local HTTPS dev works too). Add `HttpOnly` to `cart_token`. **Check theme-default first** (separate repo, `@bermooda/theme-default`): if a theme component reads `cart_token` with `document.cookie`, that read has to move to loader data in the same change.
- **Done when:** helper tests cover the flag matrix (https/http base URL), and the cart, checkout, currency, locale, and consent cookie tests assert the new attributes.

### K3. Referral tracking runs on every storefront page view (Low, perf) — open

- **Where:** `routes/storefront/_layout.jsx` loader → `trackReferral` (`#/core/loyalty/index.server`).
- **Problem:** A logged-in customer carrying a `bermooda_ref` cookie (30-day max age) triggers loyalty DB work on every page for up to 30 days. Errors are silently swallowed, including unexpected ones.
- **Fix:** After `trackReferral` succeeds, or fails permanently (self-referral, unknown code, already referred), clear the cookie with `Max-Age=0` through K2's helper. Log unexpected errors via `#/utils/logger.server` instead of discarding them. Check which errors `trackReferral` throws so you only treat the permanent ones as permanent.
- **Done when:** a layout loader test shows the cookie is cleared after tracking and that an unexpected error is logged.

## Work plan

One PR, Conventional Commit title per AGENTS.md: **`fix(storefront): harden storefront cookies`**, covering K1 → K2 → K3 in that order (K2 and K3 build on K1's helper). Run `/security-review` on the branch before opening it.

### Validation

```bash
npx vitest run app/utils app/core/currency app/core/i18n app/routes/storefront
npm run lint
```

No Prisma schema change is needed.

## Status checklist

- [ ] K1 `readCookie` helper, five callers migrated, `getCookieValue` removed
- [ ] K2 `serializeCookie` with `Secure` (+ `HttpOnly` on `cart_token` after the theme check)
- [ ] K3 referral cookie cleared after tracking; unexpected errors logged
- [ ] "Storefront cookie hardening" row in [code-quality-review.md](../code-quality-review.md) marked ✅ with a summary
