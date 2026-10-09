# Audit: `app/core/i18n/` (locale resolution and message catalogs)

Audit date: 2026-10-09. Baseline commit: `129974d` (bermooda 0.11.1).

Status: **open.** The first pass fixed the items under [Fixed in the audit PR](#fixed-in-the-audit-pr). The items under [Open](#open) are scoped for a later session; each has a location, the problem, and a proposed fix.

## Why this area

Picked at random from the `app/core` areas without an audit doc. It's small (~470 lines of source plus three ~95 KB catalogs), but it runs on every storefront and admin request: each layout loader resolves a locale and serializes a message catalog into the page.

## Scope and file map

| File                                                                                                                                        | Role                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [app/core/i18n/locales.js](../../app/core/i18n/locales.js)                                                                                  | Client-safe constants, tag validation, cookie parse, Accept-Language negotiation |
| [app/core/i18n/index.js](../../app/core/i18n/index.js)                                                                                      | Client-safe `translate`, `useT`, `useLocale`, `useI18nValue`                     |
| [app/core/i18n/index.server.js](../../app/core/i18n/index.server.js)                                                                        | Request locale (storefront/admin), cookie, catalog merge + cache                 |
| [app/core/i18n/messages/\*.json](../../app/core/i18n/messages/)                                                                             | Core catalogs (1,515 keys; 1,511 are `admin.*`)                                  |
| [app/routes/storefront/\_layout.jsx](../../app/routes/storefront/_layout.jsx)                                                               | Storefront i18n provider                                                         |
| [app/routes/admin/\_layout.jsx](../../app/routes/admin/_layout.jsx), [admin/public/\_layout.jsx](../../app/routes/admin/public/_layout.jsx) | Admin i18n providers                                                             |
| [app/routes/storefront/api/set-locale/index.jsx](../../app/routes/storefront/api/set-locale/index.jsx)                                      | `POST /api/set-locale` (storefront + admin switcher)                             |
| [app/core/storefront/page-context.server.js](../../app/core/storefront/page-context.server.js) (`parseReturnTo`)                            | `returnTo` validation for set-locale / set-currency                              |
| [app/root.jsx](../../app/root.jsx)                                                                                                          | `<html lang>`                                                                    |
| [app/components/admin/settings/general-tab.jsx](../../app/components/admin/settings/general-tab.jsx)                                        | Admin locale switcher, default locale field                                      |
| [app/emails/i18n.server.js](../../app/emails/i18n.server.js), [app/emails/locale.server.js](../../app/emails/locale.server.js)              | Email catalogs and locale (read for context, unchanged)                          |

## Findings

Severity: **High** = security or data-integrity risk on a real deployment · **Medium** = wrong behavior, outage risk, or measurable cost in realistic cases · **Low** = cleanup, drift risk, docs.

### Fixed in the audit PR

| ID  | Severity | Category                     | Finding                                                                                                                                                                                                                                                                                                                                                             | Fix                                                                                                                                                                                                                                                                                                               |
| --- | -------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | High     | Performance / scalability    | The storefront layout returned the full `loadMessages` catalog. 99.7% of core keys are `admin.*`, so every shopper got ~92–99 KB of admin UI strings in each document's hydration data, and again in every layout revalidation (each cart/currency/locale action). Measured with the default theme, `de`: home HTML 143,363 B (36,479 B gzip); `/_.data` 111,174 B. | `loadStorefrontMessages(locale)` drops the `admin` namespace (flat `admin.x` keys and a nested `admin` object), cached as `i18n:storefront:<locale>` (busted with `i18n:`). After: home HTML 32,289 B (9,326 B gzip), `/_.data` 8,251 B. Rule documented in `docs/i18n.md`, `themes.md`, `plugins.md`.            |
| A1  | Medium   | Accessibility (WCAG 3.1.1)   | `<html lang="en">` was hard-coded, so screen readers read German/French storefront and admin pages with English pronunciation rules.                                                                                                                                                                                                                                | Root `Layout` takes `lang` from the innermost layout whose loader returned `locale` + `messages`. Verified on the dev server: storefront `de` → `lang="de"`, `/admin/login` with `Accept-Language: fr` → `lang="fr"`, 404 → `en`.                                                                                 |
| R1  | Medium   | Correctness (React Router 8) | Found while fixing A1: React Router 8 removed `UIMatch.data` (now `loaderData`). `root.jsx` read `rootMatch?.data?.theme`, which is always `undefined`, so the `theme=dark` cookie never put `dark` on the server-rendered `<html>`; dark-mode users got a light first paint until the inline script ran.                                                           | Reads `loaderData`. Verified: `Cookie: theme=dark` → `<html … dark>`. No other `match.data` readers in `app/`.                                                                                                                                                                                                    |
| C1  | Medium   | Correctness                  | `parseAcceptLanguage` only looked at the first range and ignored `q`. `es-ES, es;q=0.9, fr;q=0.8` on a shop with `en`/`fr` fell to the default instead of `fr`; `en;q=0.2, de;q=0.9` picked `en`.                                                                                                                                                                   | Replaced with `negotiateAcceptLanguage(header, supported)`: ranges sorted by `q` (header order breaks ties), `*`/`q=0`/malformed `q` ignored, exact region match then primary subtag, at most 32 ranges parsed. Table-driven tests.                                                                               |
| C2  | Medium   | Correctness                  | Admin locale was resolved against the **storefront**-enabled locales, and `/api/set-locale` rejected anything else. With the storefront set to `en` only, Settings → General still offered Deutsch/Français, and choosing one silently did nothing. Admin requests also looked up the customer session and `Customer.preferredLocale` on every page.                | `getAdminRequestLocale` resolves cookie → Accept-Language → `defaultLocale` → `en` against `ADMIN_AVAILABLE_LOCALES`, with no customer lookup. Used by both admin layouts and the settings loader. `set-locale` accepts storefront-enabled ∪ admin locales; each surface ignores a cookie value it doesn't serve. |
| R2  | Medium   | Reliability                  | A theme/plugin `i18n/*.json` with invalid JSON threw from `loadMessages`. The failure wasn't cached, so every storefront and admin request re-read the file and returned 500 until the file was fixed. Extension discovery already logs and skips malformed packages (extensions audit R1).                                                                         | `mergeCatalogFiles` logs `Skipping unreadable i18n catalog` (or `…that is not an object` for arrays/scalars) and skips the file. Missing files are still skipped silently.                                                                                                                                        |
| S2  | Medium   | Security (open redirect)     | `POST /api/set-locale` (and `/api/set-currency`) redirect to `parseReturnTo(formData)`, which only checked `startsWith('/') && !startsWith('//')`. Browsers resolve `/\evil.com` and `/<tab>/evil.com` to `//evil.com`, so a cross-site form post bounced shoppers through the shop's domain to any site. No auth needed, so `SameSite` doesn't help.               | `parseReturnTo` resolves the value against a placeholder origin with `new URL` and falls back to `/` unless the origin is unchanged; returns path + query + hash. Regression tests for `//`, `/\`, `/<tab>/`, `/<newline>/` (the last three failed on the old code).                                              |
| S1  | Low      | Security (hardening)         | `deepMerge` copied every key from extension JSON. `JSON.parse` keeps `__proto__` as an own key, and the merge then assigned it through the setter, replacing the merged catalog's prototype (so `messages[key]` could resolve inherited, attacker-chosen strings). Extensions are trusted code, so impact is low.                                                   | `deepMerge` skips `__proto__`, `constructor`, `prototype`. Tested.                                                                                                                                                                                                                                                |
| M1  | Low      | Maintainability / perf       | Three layouts each re-declared `function t(key, params) { return translate(key, params, messages) }` and passed a fresh `{ t, locale }` object, re-rendering every `useT()` consumer on each layout render.                                                                                                                                                         | Shared `useI18nValue(locale, messages)` (memoized) in `#/core/i18n`; all three layouts use it.                                                                                                                                                                                                                    |
| M2  | Low      | Maintainability              | Dead or duplicate exports: `t` re-export from `index.server` (tests only), `resolveRequestLocale` (alias of `resolveLocale`), `setLocaleCookie` (wrapper of `appendLocaleCookie`), `getAvailableLocales` (duplicate of settings `getEnabledLocales`), the unused `availableLocales` field in the admin layout loader, and `useLocale` hard-coding `'en'`.           | Removed; callers use `resolveLocale`, `appendLocaleCookie`, and `getEnabledLocales` from `#/core/settings`. `useLocale` falls back to `DEFAULT_LOCALE`. Tests moved to the surviving helpers.                                                                                                                     |
| A2  | Low      | Accessibility                | The admin locale and default-locale `<select>`s had a `<label>` not associated with the control (`FieldLabel` had no `htmlFor`), so assistive tech announced them without a name; the help text wasn't linked.                                                                                                                                                      | `FieldLabel` takes `htmlFor`; both selects have ids, and the admin locale select has `aria-describedby` for its help text. (The other settings fields are open item O3.)                                                                                                                                          |
| D1  | Low      | Documentation                | No i18n reference: resolution chain, merge order, cache keys, client hooks, and how to add a locale were spread across plan docs.                                                                                                                                                                                                                                   | New [docs/i18n.md](../i18n.md); `themes.md` and `plugins.md` link it and state the `admin.*` storefront rule.                                                                                                                                                                                                     |
| T1  | Low      | Testing                      | No tests for Accept-Language beyond the first range, admin resolution, invalid extension catalogs, prototype keys, storefront scope, `useLocale`, or flat-key fallback in `translate`.                                                                                                                                                                              | Added (`index.test.jsx`, `index.test.server.js`, `set-locale/index.test.jsx`).                                                                                                                                                                                                                                    |

Verified non-issues:

- **Path traversal in catalog paths:** `locale` reaching `loadMessages` is always an enabled or admin locale (both pass `isValidLocaleTag`, `^[a-z]{2,8}(-[A-Z]{2,4})?$`), and theme/plugin slugs pass `SLUG_PATTERN` at registration.
- **Cache growth:** `i18n:*` keys are bounded by the enabled + admin locales for the same reason.
- **Cookie injection:** `appendLocaleCookie` refuses anything that fails `isValidLocaleTag` (tested).

### Open

#### O1. Admin layout re-sends the full catalog on every admin mutation (Medium, performance)

- **Where:** `app/routes/admin/_layout.jsx` loader.
- **Problem:** React Router revalidates the admin layout after every action, so each save in the admin re-downloads ~92–99 KB of messages that only change on a locale switch or a theme/plugin change. P1 fixed the storefront side only.
- **Proposed fix:** serve catalogs from a resource route with a content hash in the URL (for example `/i18n/admin/<locale>.<hash>.json`, `Cache-Control: immutable`) and have the layout return only the hash; or move `messages` into a child layout with a `shouldRevalidate` that returns true only for `/api/set-locale`, theme and plugin actions. Measure `.data` size before and after.

#### O2. Stale storefront locale cookie is never rewritten (Low, performance)

- **Where:** `resolveLocale` in `index.server.js`.
- **Problem:** when the `locale` cookie names a locale the storefront no longer enables (or an admin-only locale, after C2), `resolveLocale` keeps the cookie because one is present. Each storefront request then falls through to `getCustomerSession` + a `Customer` query.
- **Proposed fix:** give the admin its own cookie (`admin_locale`, read before `locale` for backward compatibility) so the storefront can safely rewrite `locale` when `cookieLocale !== resolved`. Update `set-locale` to write the cookie for the surface that posted (hidden `scope` field).

#### O3. Other admin settings labels aren't associated with their controls (Medium, accessibility)

- **Where:** `app/components/admin/settings/{general,seo,tax,address-validation}-tab.jsx` (13 remaining `FieldLabel` uses without `htmlFor`).
- **Problem:** WCAG 1.3.1 / 4.1.2: screen readers announce the inputs without a name; clicking the label doesn't focus the field.
- **Proposed fix:** pass `htmlFor` + `id` at each call site (A2 added the prop), or have `FieldLabel` wrap its control.

#### O4. Locale switchers submit on `change` (Low, accessibility)

- **Where:** `AdminLocaleField` (`general-tab.jsx`) and the default theme header switcher (`@bermooda/theme-default`, separate repo).
- **Problem:** WCAG 3.2.2 (On Input): changing the select reloads the page in another language without warning. Arrow-key browsing of a closed `<select>` fires `change` on some platforms.
- **Proposed fix:** add a visible "Apply" button (kept for no-JS too) and drop `requestSubmit` on change, or announce the behavior in the help text. The theme part needs a PR in the theme repo.

#### O5. Locale options without catalogs (Low, UX / accessibility)

- **Where:** `LOCALE_OPTIONS` in `locales.js`; Settings → Locales.
- **Problem:** merchants can enable `es`, `pt`, `ja`, but neither core nor the default theme ships those catalogs, so shoppers get English text while `<html lang>` says `ja`.
- **Proposed fix:** in the Locales tab, mark locales that have no catalog in the active theme (check `app/themes/<slug>/i18n/<locale>.json` server-side), or limit options to locales with theme catalogs.

#### O6. Three different "default locales" lists (Low, maintainability)

- **Where:** `SETTING_DEFAULTS.locales` = `['en','de','fr']` (`settings/defaults.js`), `parseLocaleSettingsInput` fallback `DEFAULT_STOREFRONT_LOCALES` = `['en']`, and `normalizeLocaleList` fallback `ADMIN_AVAILABLE_LOCALES`.
- **Problem:** an empty or missing `locales` setting means `en/de/fr` on read but `en` on save, and the read fallback is tied to the admin list by accident.
- **Proposed fix:** decide on one storefront default, use it in all three places, and add a test that seeding, reading an unset value, and saving an empty list agree.

#### O7. `preferredLocale` is stored without validation (Low, data integrity)

- **Where:** `pickCustomerProfileFields` / `updateCustomer` (`app/core/customers/index.server.js`), admin customer route, admin API `PATCH customers/:id`, customer import.
- **Problem:** any string (or non-string from the API body) is written. Reads validate (`isValidLocaleTag` + enabled check), so a bad value is silently ignored rather than rejected. `loadEmailMessages` also caches one catalog copy per distinct valid tag.
- **Proposed fix:** validate against `LOCALE_OPTIONS` (or `isValidLocaleTag`) on write and return 422 from the API; key the email cache by the catalog actually found (fall back to `en`).

#### O8. No plural support in `translate` (Low, i18n quality)

- **Where:** `translate` in `index.js`.
- **Problem:** only `{name}` substitution, so count strings ("{count} items") can't be correct in every language.
- **Proposed fix:** support an `Intl.PluralRules`-keyed form (for example `key.one` / `key.other` chosen when `params.count` is set), with tests and docs. Check the key coverage script handles plural sub-keys.

#### O9. Ineffective dynamic import of `index.server` (Low, maintainability)

- **Where:** `buildLifecycleCtx` in `app/core/plugins/ctx.server.js`.
- **Problem:** the build warns `INEFFECTIVE_DYNAMIC_IMPORT`: the module is also imported statically, so the dynamic import only breaks the plugins → i18n → plugins cycle at evaluation time.
- **Proposed fix:** pass a catalog loader into `buildLifecycleCtx` from the caller (or move the plugin slug lookup out of `i18n/index.server`) and import statically.

## Verification (first pass)

- `npx vitest run`: 150 files, 1,526 tests passed.
- `npm run lint` (oxlint + oxfmt) clean; `npm run check:i18n` OK; `npm run build` OK.
- Dev server with `@bermooda/theme-default` 0.2.1: sizes above measured with `curl` against `/` and `/_.data` for `en` and `de`, with the changes stashed vs applied; `lang` and `dark` checked on the storefront, `/admin/login` and a 404.
