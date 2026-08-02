# Translation Phase 3 — executable tasks

> Derived from [2026-08-01-translation-follow-ups.md](./2026-08-01-translation-follow-ups.md) Phase 3 + remaining Wave 2+ admin extraction.
> Use with subagent-driven-development. Each `## Task N` heading is extractable via `task-brief`.

**Goal:** Flatten remaining nested core message keys, add optional CI key-coverage for email + core catalogs, and finish admin UI copy extraction via `useT()` across all authenticated admin routes/components (plus public auth pages).

## Global constraints

- Conventional Commits on every commit (`docs:`, `feat:`, `fix:`, `refactor:`, `test:`, `ci:` as appropriate).
- JS/JSX in `app/` (no TypeScript). JSDoc on every new/changed export.
- Imports use `#/*` (except relative siblings inside themes/plugins).
- Do not bump `package.json` version; release-please owns releases.
- Prefer `useT()` from `#/core/i18n`. Add flat dotted keys to `app/core/i18n/messages/en.json` and matching de/fr overlays.
- Do not flatten theme/plugin catalogs; do not rework storefront theme extraction.
- Keep `resolveMessageKey` dual nested+flat lookup until callers are audited (Task 1 migrates remaining nested entries; dual lookup stays).
- Extract **user-visible static UI copy** only (titles, subtitles, labels, buttons, empty states, placeholders, column headers, fixed status labels, aria-labels, help text). Leave dynamic data (names, emails, SKUs, API errors that are already domain messages) alone.
- Skip translating `meta()` document titles unless already using `t` nearby — optional polish, not required.
- After each task: focused tests green; commit with Conventional Commit subject.

**Extraction pattern (every admin page):**

```jsx
import { useT } from '#/core/i18n';

export default function AdminSomethingRoute() {
  const t = useT();
  // ...
  return (
    <PageHeader
      title={t('admin.products.index.title')}
      subtitle={t('admin.products.index.subtitle')}
    />
  );
}
```

Key naming: `admin.<area>.<page>.<element>` (e.g. `admin.products.index.newButton`, `admin.orders.status.paid`). Reuse shared keys (`common.save`, `common.cancel`, `common.loading`, `common.error`) when the English string matches.

---

## Task 1: Flatten nested core message keys

**Files:**
- `app/core/i18n/messages/en.json` — replace nested `common` / `admin.topbar` objects with flat keys:
  - `common.loading`, `common.error`, `common.save`, `common.cancel`
  - `admin.topbar.switchLocale`
- `app/core/i18n/messages/de.json` / `fr.json` — add the same flat keys with translations (de/fr currently omit these nested keys and rely on en-fallback; add overlays).
- `app/core/i18n/index.test.server.js` — update mocks/assertions that use nested `messages.common.*` object access to flat keys (`messages['common.save']` or equivalent) where the catalog shape changed.
- Keep nested-traversal tests in `app/core/i18n/index.test.jsx` (they test `resolveMessageKey` behavior with nested **fixture** objects, not the on-disk catalog).

**Do not** remove dual lookup from `resolveMessageKey` in this task.

**Validation:** `npm run test -- app/core/i18n/` then commit `refactor(i18n): flatten remaining nested core message keys`.

---

## Task 2: CI key-coverage for email + core message catalogs

**Goal:** Script comparing `en` vs `de`/`fr` keys for:
1. `app/emails/i18n/*.json`
2. `app/core/i18n/messages/*.json`

Fail (non-zero exit) when any locale is missing keys present in `en`. For core messages, compare **flat leaf keys** after normalizing nested objects to dotted paths (so pre-flatten leftovers or accidental nesting still compare fairly). Email catalogs are already flat.

**Implementation:**
- Add `scripts/check-i18n-key-coverage.mjs` (Node ESM, no new deps).
- Add npm script `"check:i18n": "node scripts/check-i18n-key-coverage.mjs"`.
- Wire into `.github/workflows/ci.yml` as a step on the lint job (or a small dedicated job) — run after `npm ci`.
- Add a focused unit/integration test OR a tiny self-check in the script that documents expected behavior; prefer exercising via vitest if a helper is exported, otherwise keep logic in the script and rely on CI + a dry-run in the task report.

**Validation:** `npm run check:i18n` exits 0 on current catalogs; commit `ci: add i18n key-coverage check for emails and core messages`.

---

## Task 3: Admin extraction — Overview group

Extract English literals via `useT` + catalogs for:
- `app/routes/admin/dashboard.jsx`
- `app/routes/admin/audit-log.jsx`
- `app/routes/admin/reports/index.jsx`
- `app/routes/admin/reports/export.jsx`
- `app/routes/admin/reports/schedules/new.jsx`

Add en + de + fr keys. Commit `feat(admin): translate overview routes via useT`.

**Validation:** `npm run test -- app/core/i18n/` (catalog still loads); lint touched files if practical; smoke that imports resolve.

---

## Task 4: Admin extraction — Catalog group

Extract for all non-test route modules under:
- `products/`, `categories/`, `price-lists/`, `collections/`, `inventory/`, `back-in-stock/`, `wishlists/`, `import/`

Also extract static copy in shared catalog UI used only by these pages if it lives in the route file. Leave `product-editor.jsx` for Task 9.

Add en + de + fr. Commit `feat(admin): translate catalog routes via useT`.

---

## Task 5: Admin extraction — Content group

Extract for:
- `pages/` (index, new, $id) — leave `page-editor.jsx` for Task 9
- `menus/index.jsx`
- `reviews/index.jsx`

Add en + de + fr. Commit `feat(admin): translate content routes via useT`.

---

## Task 6: Admin extraction — Sales group

Extract for non-test modules under:
- `orders/`, `returns/`, `discounts/`, `gift-cards/`, `subscriptions/`, `pos/`, `quotes/`, `shipments/`

Also translate `order-status-badge.jsx` and `return-status-badge.jsx` (fixed status labels).

Add en + de + fr. Commit `feat(admin): translate sales routes via useT`.

---

## Task 7: Admin extraction — Customers + Growth

Extract for:
- `customers/`, `customer-groups/`, `companies/`, `loyalty/`
- `marketing/`, `channels/`

Add en + de + fr. Commit `feat(admin): translate customers and growth routes via useT`.

---

## Task 8: Admin extraction — Configuration + Settings tabs

Extract for:
- `themes/index.jsx`, `plugins/index.jsx`, `plugins/$pluginId.jsx`
- `api-settings.jsx`, `api-settings/keys/new.jsx`, `api-settings/webhooks/new.jsx`
- `settings/index.jsx`, `settings/users/new.jsx`
- All `app/components/admin/settings/*.jsx` tabs (general, locales, currencies, tax, shipping, seo, email-templates, admin-users, address-validation, shared)

Add en + de + fr. Commit `feat(admin): translate configuration and settings via useT`.

---

## Task 9: Admin extraction — Shared editors + remaining components

Extract static copy in:
- `app/components/admin/product-editor.jsx`
- `app/components/admin/page-editor.jsx`
- `app/components/admin/seo-fields.jsx`
- `app/components/admin/search-field.jsx` (placeholder defaults if any)
- `app/components/admin/sortable-list.jsx`
- `app/components/admin/slug-field/` (user-visible strings)
- `app/components/admin/locale-tabs/` (user-visible strings)
- `app/components/admin/form/*` only if they contain user-visible English defaults
- Any remaining admin component with hardcoded English UI strings not covered above

Add en + de + fr. Commit `feat(admin): translate shared admin editors via useT`.

---

## Task 10: Admin public auth pages via useT

Public auth routes sit outside authenticated `AdminLayout` / `I18nContext`.

1. Wire `loadMessages` + `I18nContext` into `app/routes/admin/public/_layout.jsx` (loader loads locale messages; provider wraps `<Outlet />`), mirroring the authenticated layout pattern (reuse `getRequestLocale` / `loadMessages` / `translate`).
2. Extract user-visible copy in:
   - `app/routes/admin/index.jsx` (login + onboarding forms)
   - `forgot-password.jsx`, `reset-password.jsx`, `verify-2fa.jsx`
   - Skip `login.jsx` (redirect-only) and `logout.jsx` unless they render copy
3. Add en + de + fr keys under `admin.auth.*`.

Commit `feat(admin): translate public auth pages via useT`.

**Validation:** `npm run check:i18n`; focused tests; ensure public layout loader does not require admin session.

---

## Task 11: Plan doc checkbox sync + final verification

1. Mark Phase 3 (+ Wave 2+) items complete in `docs/superpowers/plans/2026-08-01-translation-follow-ups.md`.
2. Run `npm run check:i18n`, `npm run lint`, `npm run build`, and a representative `npm run test` subset (at least `app/core/i18n/` + any touched test files).
3. Commit `docs: mark translation phase 3 complete` if doc-only, or include with a chore commit if needed.

---
