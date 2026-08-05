# Admin design language — migration plan

Incremental rollout of [admin-design-language.md](./admin-design-language.md) across admin routes. Products list + product editor are the reference and are **done**.

Use one **session / PR** per checklist section (or a smaller subset if a section is large). After each session: visual smoke in light + dark, ~360px and desktop; run lint on touched files.

**Cursor rule:** [`.cursor/rules/admin-design-language.mdc`](../.cursor/rules/admin-design-language.mdc)

**Do not force** list/detail patterns onto: dashboard, reports, settings hubs, themes, plugins marketplace, POS, import, inventory management, categories tree, menus sortable, marketing hub, auth, PDF/CSV loaders. Those get token/`PageHeader` polish only when touched.

---

## Status legend

| Mark  | Meaning                         |
| ----- | ------------------------------- |
| `[ ]` | Not started                     |
| `[~]` | Partial / in progress           |
| `[x]` | Done (matches products pattern) |

---

## Phase 0 — Foundation (done)

- [x] Design language doc — `docs/admin-design-language.md`
- [x] Cursor rule — `.cursor/rules/admin-design-language.mdc`
- [x] Retire `docs/admin-redesign-plan.md`
- [x] Reference list — `app/routes/admin/products/index.jsx`
- [x] Reference detail — `app/components/admin/product-editor.jsx` (+ `products/$id`, `products/new`)

**Done:** shared `FormSection` lives in `#/components/admin/form-section.jsx` (extracted with Phase 4a).

---

## Phase 1 — High-traffic list pages (sticky table)

Target composition: `PageHeader` → optional `Stat` → bordered `Toolbar` + `SearchField` → `Table variant="sticky"` (or standalone `EmptyState`) → `Pagination`. Drop card wrappers around the main table; row → detail; responsive column hiding.

### 1a — Orders index

- [x] `app/routes/admin/orders/index.jsx`
- Notes: already has Stat/Toolbar/Table; remove card wrapper; adopt sticky; use `SearchField` if not already; EmptyState outside table body.

### 1b — Customers index

- [x] `app/routes/admin/customers/index.jsx`
- Notes: same gaps as orders.

### 1c — Pages index

- [x] `app/routes/admin/pages/index.jsx`
- Notes: status filter pills in toolbar are fine; sticky table + EmptyState pattern.

---

## Phase 2 — Remaining table indexes

Same sticky list pattern. Add Toolbar/SearchField where missing.

### 2a — Gift cards & wishlists

- [x] `app/routes/admin/gift-cards/index.jsx`
- [x] `app/routes/admin/wishlists/index.jsx`

### 2b — Back in stock & returns

- [x] `app/routes/admin/back-in-stock/index.jsx` (prefer `#/components/admin/tabs` if replacing custom tabs)
- [x] `app/routes/admin/returns/index.jsx`

### 2c — Reviews & audit log

- [x] `app/routes/admin/reviews/index.jsx`
- [x] `app/routes/admin/audit-log.jsx` (filters → Toolbar; not a Card form above the table)

---

## Phase 3 — Card/list hubs → sticky tables

These indexes should become standard resource lists (not card stacks / `<ul>`s).

### 3a — Discounts & collections

- [x] `app/routes/admin/discounts/index.jsx`
- [x] `app/routes/admin/collections/index.jsx` (also remove legacy `stone-*` tokens)

### 3b — Price lists & customer groups

- [x] `app/routes/admin/price-lists/index.jsx`
- [x] `app/routes/admin/customer-groups/index.jsx`

### 3c — B2B / commerce lists

- [x] `app/routes/admin/companies/index.jsx`
- [x] `app/routes/admin/quotes/index.jsx`
- [x] `app/routes/admin/subscriptions/index.jsx`

---

## Phase 4 — Detail forms (FormSection pattern)

Target: `mx-auto max-w-5xl` → `PageHeader` + `Breadcrumbs` → two-column `FormSection` stack → footer (delete · cancel · save). Prefer shared `FormSection` once extracted. Replace Card + sticky `ActionBar` unless sticky save is clearly needed.

### 4a — Page editor (unlocks pages create/edit)

- [x] `app/components/admin/page-editor.jsx`
- [x] Verify `app/routes/admin/pages/$id.jsx` + `pages/new.jsx` (thin routes)
- Notes: extracted shared `FormSection` to `#/components/admin/form-section.jsx`; product-editor imports it.

### 4b — Collections create/edit

- [ ] `app/routes/admin/collections/new.jsx`
- [ ] `app/routes/admin/collections/$id.jsx`

### 4c — Discounts create/edit

- [ ] `app/routes/admin/discounts/new.jsx`
- [ ] `app/routes/admin/discounts/$id.jsx`

### 4d — Categories create/edit

- [ ] `app/routes/admin/categories/new.jsx`
- [ ] `app/routes/admin/categories/$id.jsx`

### 4e — Customers create + edit

- [ ] `app/routes/admin/customers/new.jsx`
- [ ] `app/routes/admin/customers/$id.jsx` (hybrid: FormSection for profile fields; nested order tables can stay `Table` default)

### 4f — Customer groups & companies

- [ ] `app/routes/admin/customer-groups/new.jsx`
- [ ] `app/routes/admin/customer-groups/$id.jsx`
- [ ] `app/routes/admin/companies/new.jsx`
- [ ] `app/routes/admin/companies/$id.jsx` (mostly readonly + member form — FormSection where editing)

### 4g — Channels

- [ ] `app/routes/admin/channels/new.jsx`
- [ ] `app/routes/admin/channels/$id.jsx`

### 4h — Price lists & gift cards / inventory create

- [ ] `app/routes/admin/price-lists/new.jsx`
- [ ] `app/routes/admin/price-lists/$id.jsx`
- [ ] `app/routes/admin/gift-cards/new.jsx`
- [ ] `app/routes/admin/inventory/new.jsx`

### 4i — Subscriptions & quotes create

- [ ] `app/routes/admin/subscriptions/new.jsx`
- [ ] `app/routes/admin/subscriptions/$id.jsx`
- [ ] `app/routes/admin/quotes/new.jsx`

### 4j — Marketing create flows

- [ ] `app/routes/admin/marketing/segments/new.jsx`
- [ ] `app/routes/admin/marketing/campaigns/new.jsx`
- [ ] `app/routes/admin/marketing/sequences/new.jsx`

### 4k — API & settings create flows

- [ ] `app/routes/admin/api-settings/keys/new.jsx`
- [ ] `app/routes/admin/api-settings/webhooks/new.jsx`
- [ ] `app/routes/admin/settings/users/new.jsx`
- [ ] `app/routes/admin/reports/schedules/new.jsx`

---

## Phase 5 — Hybrid detail (chrome only)

Use detail shell (`PageHeader`, breadcrumbs, width, semantic tokens, section titles). Do **not** force a full FormSection save footer if the page is inspection-first.

### 5a — Orders detail

- [x] `app/routes/admin/orders/$id.jsx`

### 5b — Quotes detail

- [x] `app/routes/admin/quotes/$id.jsx`

### 5c — Product merchandising sub-page

- [x] `app/routes/admin/products/$id/merchandising.jsx` (breadcrumbs + FormSection-style sections where fields exist)

---

## Phase 6 — Out-of-pattern surfaces (polish only)

When touching these, align tokens + `PageHeader` only. Keep bespoke layouts.

### 6a — Overview

- [ ] `app/routes/admin/dashboard.jsx`
- [ ] `app/routes/admin/reports/index.jsx`

### 6b — Config hubs

- [ ] `app/routes/admin/settings/index.jsx` (+ tab panels as needed)
- [ ] `app/routes/admin/api-settings.jsx`
- [ ] `app/routes/admin/loyalty/index.jsx`

### 6c — Marketplace / tools

- [ ] `app/routes/admin/themes/index.jsx`
- [ ] `app/routes/admin/plugins/index.jsx`
- [ ] `app/routes/admin/marketing/index.jsx`
- [ ] `app/routes/admin/import/index.jsx`
- [ ] `app/routes/admin/pos/index.jsx`

### 6d — Non-table management UIs

- [ ] `app/routes/admin/categories/index.jsx` (sortable tree)
- [ ] `app/routes/admin/menus/index.jsx` (sortable menu editor)
- [ ] `app/routes/admin/channels/index.jsx` (hybrid table + inline forms)
- [ ] `app/routes/admin/inventory/index.jsx` (locations + inline qty)

### 6e — Plugin host

- [ ] `app/routes/admin/plugins/$pluginId.jsx` (error/empty chrome only)

**Skip UI:** `orders/$id/documents.jsx`, `shipments/$id/documents.jsx`, `reports/export.jsx` (loaders / downloads). Auth routes are out of scope for this plan.

---

## Suggested session order

| Session | Work from this plan                                   |
| ------- | ----------------------------------------------------- |
| 1       | Phase 1a — Orders index                               |
| 2       | Phase 1b — Customers index                            |
| 3       | Phase 1c — Pages index                                |
| 4       | Phase 2a                                              |
| 5       | Phase 2b                                              |
| 6       | Phase 2c                                              |
| 7       | Phase 3a                                              |
| 8       | Phase 3b                                              |
| 9       | Phase 3c                                              |
| 10      | Optional: extract `FormSection` + Phase 4a PageEditor |
| 11+     | Phase 4b → 4k (one lettered section per session)      |
| …       | Phase 5, then Phase 6 as needed                       |

---

## Per-session checklist

Copy into the PR description:

```md
## Summary

- Migrate <route> to admin design language ([docs/admin-design-language.md](docs/admin-design-language.md))

## Checklist

- [ ] Matches list or detail pattern from the design language doc
- [ ] Semantic tokens only (no gray/zinc/stone/gradients)
- [ ] Light + dark smoke
- [ ] Mobile (~360px) + desktop
- [ ] Mark section `[x]` in docs/admin-design-language-migration.md
```

---

## How to pick up a session

Prompt example:

> Continue admin design language migration: Phase 1a — Orders index. Follow `docs/admin-design-language.md` and mark the checkbox in `docs/admin-design-language-migration.md` when done.
