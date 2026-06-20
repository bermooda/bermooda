---
name: W5 — CMS, Reviews, SEO (Detailed Plan)
overview: Detailed implementation plan for execution-plan chunk p2-w5. Covers schema, core modules, admin/storefront routes, theme updates, SEO utilities, tests, and validation gate. Planning only — no implementation in this document.
parentPlan: .cursor/plans/oss_competitor_execution_plan_af4cae39.plan.md
dependsOn: [W0, W1]
unblocks: [W9]
isProject: false
todos:
  - id: w5-preflight
    content: 'Pre-flight: re-confirm roadmap findings, lock architecture decisions (slug route, locale SEO, theme import pattern)'
    status: pending
  - id: w5-1-schema
    content: 'W5-1a: Prisma schema — Page, Menu, MenuItem, Review + migration'
    status: pending
  - id: w5-1-core
    content: 'W5-1b: app/core/content/index.server.js — page CRUD, slug resolution, publish workflow'
    status: pending
  - id: w5-1-admin
    content: 'W5-1c: Admin pages CRUD (list, new, edit) with locale tabs'
    status: pending
  - id: w5-1-storefront
    content: 'W5-1d: Storefront CMS route + PagePage theme component'
    status: pending
  - id: w5-2-menus
    content: 'W5-2: Menu builder (core + admin + theme header/footer consumption)'
    status: pending
  - id: w5-3-reviews
    content: 'W5-3: Reviews core + storefront submit + admin moderation + product aggregates'
    status: pending
  - id: w5-4-seo
    content: 'W5-4: SEO utilities — meta, canonical/hreflang, JSON-LD, dynamic sitemap'
    status: pending
  - id: w5-validate
    content: 'Validation gate: tests, lint, build, manual structured-data check'
    status: pending
---

# W5 — CMS + Reviews + SEO (Detailed Implementation Plan)

This is the **next pending chunk** on [oss_competitor_execution_plan_af4cae39.plan.md](oss_competitor_execution_plan_af4cae39.plan.md) (`p2-w5`, status: pending). It operationalizes roadmap section **W5** from [docs/oss-competitor-roadmap_b3f9a1c7.md](../docs/oss-competitor-roadmap_b3f9a1c7.md).

**Scope:** One handoff unit — schema → core → routes → theme → tests → validation gate → PR.

**Out of scope for W5:** Locale-in-URL routing overhaul (defer full i18n URL refactor to W8/W9; document interim hreflang limitations), runtime theme hot-swap (W0-6 chose import-based themes), public API endpoints for CMS/reviews (optional stretch — admin UI is required).

---

## Pre-flight checklist (do first)

Re-confirm these findings still hold before writing code:

| Finding                           | Expected state                                  | Where to verify                                                                                 |
| --------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No `Page` model                   | Absent from schema                              | `prisma/schema.prisma`                                                                          |
| No menu builder                   | Hardcoded nav links                             | `app/themes/default/components/storefront-chrome.jsx` (Gift Guide, Trade Program, Stores → `/`) |
| No reviews                        | `fakeReviews()` placeholder                     | `app/themes/default/components/home-page.jsx`                                                   |
| Basic meta only                   | Title = entity title, no JSON-LD                | `app/routes/storefront/products/$slug.jsx`, `categories/$slug.jsx`                              |
| Static sitemap                    | `INDEXED_ROUTES` only, no DB entities           | `app/routes/sitemap.jsx`, `app/routes.js`                                                       |
| Translation/Slug ready for `page` | Infrastructure exists; `page` entityType unused | `Translation`, `Slug` models; phase-1-plan reserved `page`                                      |
| W1 search done                    | `/search` route + search box                    | `app/routes/storefront/search.jsx`, `storefront-chrome.jsx`                                     |
| W0-6 theme decision               | Import-based; manifest lists components         | `app/core/bootstrap.server.js`, `app/themes/default/manifest.js`                                |

---

## Architecture decisions (lock before coding)

### 1. CMS page URL pattern

**Decision:** Top-level slug route `/:slug` that resolves via existing `resolveSlug()` in catalog core (move or re-export from content core).

**Why not `pages/:slug`:** Roadmap specifies `/:slug`; shorter URLs are standard for CMS (About, Contact, Shipping Policy).

**Route ordering in `app/routes.js`:**

```
storefront/_layout children:
  ... existing reserved paths (products/, categories/, search, cart, checkout/, account/, apps/) ...
  route(':slug', 'routes/storefront/pages/$slug.jsx')   ← NEW, after all reserved prefixes
```

The catch-all `route('*', 'routes/404.jsx')` stays **last** at the root level. The `:slug` route lives **inside** the storefront layout so it cannot shadow `admin/*`, `api/*`, `webhooks/*`, etc.

**Loader logic:**

1. Call `resolveSlug(params.slug)`.
2. If `entityType === 'page'`, load page via content core; 404 if unpublished or missing.
3. If slug not found → 404 (do not fall through to product/category — those use prefixed paths).
4. Reserved slug denylist: block slugs that match known route segments even if unclaimed (`search`, `cart`, `checkout`, `account`, `admin`, `api`, `health`, `sitemap.xml`, etc.).

### 2. Theme component pattern (W0-6)

**Decision:** Follow existing import-based pattern — routes import theme components directly from `#/themes/default/components/...`. Add new components to `manifest.js` `components` map for future runtime resolution (W8) but do not switch routes to `getStorefrontComponent()` in W5.

**New theme components required:**

| Component                      | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `PagePage`                     | Renders CMS page body + title                       |
| `ProductReviews`               | Review list + submit form (embedded in ProductPage) |
| Update `StorefrontShell` / nav | Consume menu data from loader                       |

### 3. Locale + SEO (interim)

**Decision for W5:** Keep cookie-based locale (`getRequestLocale`). Do **not** introduce locale-prefixed URLs (`/de/about`) in this chunk.

**hreflang approach (interim):**

- Emit `<link rel="alternate" hreflang="..." href="...">` for each locale where a **slug row exists** for the same entity.
- All alternates share the same URL path; crawlers see identical URLs with different content based on cookie — **imperfect but documented**.
- Add a code comment + note in validation gate that full locale-in-URL is a W8/W9 follow-up.
- `canonical` link points to the default-locale slug URL (from `Slug` where `canonical: true` or shop `defaultLocale`).

### 4. Page body storage

**Decision:** Store page body as a `Translation` field (`field: 'body'`) alongside `title`, `metaTitle`, `metaDescription`. Keep structured `Page` model lean (status, type, timestamps). Reuse catalog's `setTranslation`/`getTranslations` helpers — either import from catalog core or extract shared translation helpers to `#/core/i18n/translations.server.js` if duplication becomes painful (prefer importing from catalog for minimal diff).

### 5. Review moderation model

**Decision:** `Review.status` enum: `pending` | `approved` | `rejected`. Only `approved` reviews appear on storefront. Default new submissions to `pending`. Admin bulk approve/reject.

**Verified purchase:** Set `verifiedPurchase: true` when submitting customer has a `paid`/`fulfilled` order containing the product (check via `OrderLine` → `ProductVariant.productId`). Guest reviews: not in W5 scope (require customer auth).

### 6. Menu handles

**Decision:** Menus identified by stable **handle** strings (`main`, `footer`, `sub-header`), not UUID in theme code. Admin creates/edits menus by handle. Theme hardcodes handle lookups; loader passes resolved menu trees.

---

## Schema design

Add a delimited section to `prisma/schema.prisma`:

```prisma
// ─── W5: CMS, navigation, reviews ───────────────────────────────────────────

model Page {
  id          String    @id @default(cuid())
  type        String    @default("page")  // "page" | "blog" (optional tag)
  status      String    @default("draft") // "draft" | "published"
  publishedAt DateTime?
  position    Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status])
  @@index([publishedAt])
}

model Menu {
  id        String   @id @default(cuid())
  handle    String   @unique  // "main", "footer", "sub-header"
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items MenuItem[]
}

model MenuItem {
  id         String   @id @default(cuid())
  menuId     String
  parentId   String?
  label      String   // fallback label; prefer Translation for i18n labels
  url        String?  // external URL or internal path (/about, /categories/foo)
  pageId     String?  // optional link to Page
  categoryId String?  // optional link to Category
  position   Int      @default(0)
  openInNew  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  menu     Menu       @relation(fields: [menuId], references: [id], onDelete: Cascade)
  parent   MenuItem?  @relation("MenuTree", fields: [parentId], references: [id])
  children MenuItem[] @relation("MenuTree")
  page     Page?      @relation(fields: [pageId], references: [id], onDelete: SetNull)

  @@index([menuId])
  @@index([parentId])
}

model Review {
  id               String   @id @default(cuid())
  productId        String
  customerId       String
  rating           Int      // 1–5
  title            String?
  body             String
  status           String   @default("pending") // pending | approved | rejected
  verifiedPurchase Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  product  Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([productId, customerId]) // one review per customer per product
  @@index([productId, status])
  @@index([status])
}
```

**Also required:**

- Add `reviews Review[]` relation on `Product` and `Customer` models.
- Add `pages Page[]` relation on `MenuItem` (shown above).
- Migration name: `w5_cms_menus_reviews`.

**Translation fields (via existing `Translation` table, not new columns):**

| entityType  | fields                                                            |
| ----------- | ----------------------------------------------------------------- |
| `page`      | `title`, `body`, `metaTitle`, `metaDescription`                   |
| `menu_item` | `label` (optional — use if label differs per locale)              |
| `product`   | add `metaTitle`, `metaDescription` (extend admin product editor)  |
| `category`  | add `metaTitle`, `metaDescription` (extend admin category editor) |

**Slug rows:** `entityType: 'page'` via existing `setSlug()`.

---

## Internal build order (within W5)

Recommended serial order minimizes rework:

```
W5-preflight (decisions)
    ↓
W5-1a schema + migration
    ↓
W5-1b content core (pages)
    ↓
W5-1c admin pages CRUD ──────────────┐
W5-1d storefront page route + theme  │ parallel after core
    ↓                                ↓
W5-2 menus (core → admin → theme nav)
    ↓
W5-3 reviews (core → product page → admin moderation)
    ↓
W5-4 SEO (meta helper → JSON-LD → sitemap → wire all routes)
    ↓
W5-validate
```

W5-4 should land **after** pages and products are renderable so sitemap/JSON-LD have real entities to enumerate.

---

## W5-1 — CMS pages

### Core: `app/core/content/index.server.js`

Mirror catalog patterns (`app/core/catalog/index.server.js`):

| Function                                               | Responsibility                                               |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| `listPages({ status, page, limit })`                   | Admin list with pagination                                   |
| `getPage(id, { locale })`                              | Full page + translations + slug for locale                   |
| `getPageBySlug(slug, { locale })`                      | Slug → page; enforce `status === 'published'` for storefront |
| `createPage({ translations, slug, type })`             | Create draft page + slug + translations                      |
| `updatePage(id, { translations, slug, type, status })` | Update; set `publishedAt` when first published               |
| `deletePage(id)`                                       | Cascade delete translations + slugs                          |
| `listPublishedPages({ locale })`                       | For sitemap                                                  |

Reuse from catalog core: `setTranslation`, `getTranslations`, `setSlug`, `resolveSlug` (import, don't duplicate).

**Events (optional but recommended for W6 audit consistency):**

- Emit `page.published`, `page.updated`, `page.deleted` via `#/core/events`.
- Register in audit subscriber map if W6 audit should capture (add to `ENTITY_TYPE_BY_EVENT` in audit core).

### Admin routes

| Route              | Module                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `/admin/pages`     | `app/routes/admin/pages/index.jsx` — list, filter by status                                           |
| `/admin/pages/new` | `app/routes/admin/pages/new.jsx`                                                                      |
| `/admin/pages/:id` | `app/routes/admin/pages/$id.jsx` — edit with locale tabs (copy pattern from `admin/products/$id.jsx`) |

**Admin nav:** Add "Pages" item to `NAV_ITEMS` in `app/routes/admin/_layout.jsx` (icon: `DocumentTextIcon`).

**Form fields per locale tab:**

- Title, slug, body (textarea or minimal markdown — plain textarea is fine for v1)
- Meta title, meta description
- Status toggle (draft/published)

### Storefront route

**File:** `app/routes/storefront/pages/$slug.jsx`

```js
// loader: getPageBySlug → 404 if missing
// meta: use buildPageMeta() from seo core (W5-4)
// default export: <PagePage {...data} />
```

### Theme: `app/themes/default/components/page-page.jsx`

- Render title + body (plain text or `dangerouslySetInnerHTML` if allowing minimal HTML — prefer escaped plain text for v1)
- Wrap in `StorefrontShell`
- Match typography of existing storefront pages

### Seed data (optional)

Add sample pages in `prisma/seed.js`: `about`, `shipping-policy` — wired to sub-header menu links currently pointing to `/`.

---

## W5-2 — Navigation / menu builder

### Core extensions in `app/core/content/index.server.js`

| Function                               | Responsibility                                                     |
| -------------------------------------- | ------------------------------------------------------------------ |
| `listMenus()`                          | All menus with item counts                                         |
| `getMenuByHandle(handle, { locale })`  | Resolved tree with labels, resolved URLs                           |
| `upsertMenu(handle, { title, items })` | Replace item tree (admin save)                                     |
| `resolveMenuItemUrl(item, { locale })` | page → `/{slug}`, category → `/categories/{slug}`, else `item.url` |

**Tree serialization for admin:** Flat list with `parentId` + `position` (same pattern as categories admin).

### Admin route

**File:** `app/routes/admin/menus/index.jsx` (single page with handle selector: main / footer / sub-header)

- Drag or up/down reorder (reuse category reorder UX)
- Item types: Custom URL, Page picker, Category picker
- Locale tabs for item labels (optional fallback to `label` column)

**Admin nav:** Add "Menus" near Pages.

### Storefront integration

**Option A (recommended):** Extend `app/routes/storefront/_layout.jsx` loader to fetch menus:

```js
const [mainMenu, footerMenu, subHeaderMenu] = await Promise.all([
  getMenuByHandle('main', { locale }),
  getMenuByHandle('footer', { locale }),
  getMenuByHandle('sub-header', { locale }),
]);
```

Pass via outlet context or have each page use `useRouteLoaderData('routes/storefront/_layout')`.

**Theme changes:**

- `storefront-chrome.jsx` — replace hardcoded Gift Guide / Trade Program / Stores links with `subHeaderMenu` items
- `StorefrontMainNav` — render `mainMenu` items instead of single Home link
- Footer in `StorefrontShell` — render `footerMenu`

**Seed:** Create default menus matching current hardcoded links until admin edits them.

---

## W5-3 — Product reviews & ratings

### Core: `app/core/reviews/index.server.js`

| Function                                                       | Responsibility                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `listReviewsForProduct(productId, { status, page, limit })`    | Storefront: approved only; admin: all                               |
| `getReviewSummary(productId)`                                  | `{ averageRating, count }` from approved reviews                    |
| `createReview({ productId, customerId, rating, title, body })` | Validate 1–5; check duplicate; set verifiedPurchase; status=pending |
| `moderateReview(id, { status })`                               | Admin approve/reject                                                |
| `deleteReview(id)`                                             | Admin                                                               |
| `hasVerifiedPurchase(customerId, productId)`                   | Query orders                                                        |

**Event:** Emit `review.submitted`, `review.approved` (add to webhook events list if public API consumers need it — stretch goal).

### Storefront

**Product loader** (`app/routes/storefront/products/$slug.jsx`): add `reviewSummary` + paginated `reviews` to loader data.

**Product page theme** (`product-page.jsx`):

- Replace any star placeholders with real `reviewSummary`
- Add reviews section: list + `<Form method="post">` submit (action on product route or dedicated `app/routes/storefront/products/$slug/reviews.jsx` POST route)
- Require login: if no session, show "Sign in to review" link

**Action handler:** authenticate via `getCustomerSession`; call `createReview`; return validation errors.

### Admin

**File:** `app/routes/admin/reviews/index.jsx`

- Tabs: Pending (default) | Approved | Rejected | All
- Columns: product, customer, rating, excerpt, verified badge, date
- Actions: Approve, Reject, Delete

**Admin nav:** Add "Reviews" with pending count badge (optional polish).

### Home page cleanup

Remove `fakeReviews()` from `home-page.jsx`; use real aggregates from catalog/search product payloads (extend product list queries to include `reviewSummary` — batch query in loader or join in catalog core helper `attachReviewSummaries(products)`).

---

## W5-4 — Richer SEO

### Core: `app/core/seo/index.server.js`

Centralize SEO logic so routes stay thin:

| Export                                                       | Purpose                                           |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `buildMeta({ entityType, entity, locale, request })`         | Returns React Router `meta()` descriptor array    |
| `buildCanonicalUrl(request, path)`                           | Absolute URL via `getDomainUrl`                   |
| `buildAlternateLinks({ entityType, entityId, request })`     | hreflang links from all slug rows                 |
| `buildProductJsonLd(product, { locale, currency, request })` | Schema.org Product + Offer                        |
| `buildBreadcrumbJsonLd(items, request)`                      | BreadcrumbList                                    |
| `buildOrganizationJsonLd(request)`                           | From `shopName` setting + site URL                |
| `serializeJsonLd(data)`                                      | Safe `<script type="application/ld+json">` string |

### Route meta upgrades

Update `meta()` exports in:

| Route                             | JSON-LD                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `storefront/index.jsx`            | Organization + WebSite (with SearchAction pointing to `/search?q=`) |
| `storefront/products/$slug.jsx`   | Product + Offer + BreadcrumbList                                    |
| `storefront/categories/$slug.jsx` | CollectionPage or ItemList (minimal) + BreadcrumbList               |
| `storefront/pages/$slug.jsx`      | WebPage + BreadcrumbList                                            |
| `storefront/search.jsx`           | keep `noindex`                                                      |

**Product/category admin:** Add meta title + meta description fields to existing editors; store as translations.

### JSON-LD component

**File:** `app/components/seo/json-ld.jsx`

```jsx
export function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

Render from route components or via meta tags (prefer component in route default export for JSON-LD — React Router meta doesn't support script bodies well).

### Dynamic sitemap

**Rewrite** `app/routes/sitemap.jsx` loader:

1. Fetch all published products (slug per default locale), categories, pages.
2. Build `<url><loc>`, `<lastmod>`, optional `<xhtml:link rel="alternate" hreflang=...>` if feasible.
3. Keep static routes (home, account login/register).
4. Remove incorrect static `products` / `categories` entries from `INDEXED_ROUTES` (those 404 today).

**Cache:** `Cache-Control: public, max-age=300` (keep existing).

### Robots

Verify `/admin/*`, `/account/*` (except login/register), `/checkout/*`, `/cart` are noindex (add where missing).

---

## Shared surfaces & coordination

| Surface                             | W5 touch                                                   | Conflict risk                                             |
| ----------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------- |
| `prisma/schema.prisma`              | New section only                                           | Low — no concurrent Phase 2 chunk should edit same models |
| `app/routes.js`                     | Append admin + storefront routes                           | Low — append-only                                         |
| `app/core/catalog/index.server.js`  | Optional: `attachReviewSummaries`, meta translation fields | Medium — read-only extension preferred                    |
| `app/core/bootstrap.server.js`      | No registration needed unless event subscribers added      | None                                                      |
| `app/core/webhooks/index.server.js` | Optional: add review events                                | Low                                                       |
| `app/core/audit/index.server.js`    | Optional: page/review events                               | Low                                                       |
| Default theme                       | New components + nav consumption                           | None — W5 owns theme content UI                           |
| `docs/api.md`                       | Optional: document review/page admin API if added          | Stretch                                                   |

**Do not edit:** `Order`/`OrderLine`, `Discount`, inventory seam, totals engine.

---

## Testing plan (80% core coverage)

| Module                             | Test file              | Key cases                                                                             |
| ---------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| `app/core/content/index.server.js` | `index.test.server.js` | CRUD, publish sets publishedAt, slug uniqueness, getPageBySlug rejects draft          |
| `app/core/reviews/index.server.js` | `index.test.server.js` | create, duplicate rejected, verifiedPurchase true/false, summary averages, moderation |
| `app/core/seo/index.server.js`     | `index.test.server.js` | canonical URL, JSON-LD shape, alternate links                                         |
| Storefront page route              | `pages/$slug.test.jsx` | 404 unpublished, 200 published                                                        |
| Sitemap route                      | `sitemap.test.jsx`     | includes product + page URLs                                                          |

Use existing test factories pattern (`app/test/factories/`).

---

## Validation gate (definition of done)

Manual scenario:

1. Admin creates CMS page "About Us" with slug `about`, publishes.
2. Admin adds page to `sub-header` menu via menu builder.
3. Storefront `/about` renders page; sub-header no longer shows dead `#` links.
4. Logged-in customer submits 5-star review on a purchased product → pending.
5. Admin approves → product page shows review + updated average.
6. View source: Product page has valid JSON-LD (`Product`, `Offer`, `BreadcrumbList`).
7. `/sitemap.xml` lists `/about`, product URLs, category URLs.
8. Google Rich Results Test (or schema validator) passes on product URL.
9. `npm run test` + `npm run lint` + `npm run build` green.

PR checklist (from execution plan):

- [ ] Roadmap findings re-confirmed
- [ ] Migration `w5_cms_menus_reviews` + `prisma/generated/` updated
- [ ] Core logic in `app/core/content`, `app/core/reviews`, `app/core/seo`
- [ ] Routes in `app/routes.js`
- [ ] 80% coverage on new core modules
- [ ] Shared-surface contracts respected

---

## Risks & mitigations

| Risk                                 | Mitigation                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `:slug` route shadows reserved paths | Denylist in loader; register route only inside storefront layout after prefixed routes |
| Cookie locale hurts hreflang         | Document limitation; canonical to default locale; plan URL-prefix locales later        |
| MenuItem URL resolution complexity   | Strict priority: pageId → categoryId → url field                                       |
| Review spam                          | One review per customer per product; pending moderation default                        |
| Sitemap size on large catalogs       | Paginate sitemap or cap with `<lastmod>` only; document limit (future: sitemap index)  |
| HTML injection in page body          | Escape on render for v1; sanitize if rich text added later                             |

---

## Files to create (summary)

```
app/core/content/index.server.js
app/core/content/index.test.server.js
app/core/reviews/index.server.js
app/core/reviews/index.test.server.js
app/core/seo/index.server.js
app/core/seo/index.test.server.js
app/components/seo/json-ld.jsx
app/routes/admin/pages/index.jsx
app/routes/admin/pages/new.jsx
app/routes/admin/pages/$id.jsx
app/routes/admin/menus/index.jsx
app/routes/admin/reviews/index.jsx
app/routes/storefront/pages/$slug.jsx
app/themes/default/components/page-page.jsx
prisma/migrations/*_w5_cms_menus_reviews/
```

## Files to modify (summary)

```
prisma/schema.prisma
prisma/seed.js
app/routes.js
app/routes/admin/_layout.jsx
app/routes/storefront/_layout.jsx
app/routes/storefront/products/$slug.jsx
app/routes/storefront/categories/$slug.jsx
app/routes/storefront/index.jsx
app/routes/sitemap.jsx
app/routes/admin/products/$id.jsx
app/routes/admin/categories/index.jsx
app/themes/default/manifest.js
app/themes/default/components/storefront-chrome.jsx
app/themes/default/components/product-page.jsx
app/themes/default/components/home-page.jsx
app/core/catalog/index.server.js (optional attachReviewSummaries)
```

---

## Stretch goals (only if core gate passes early)

- Admin API: `GET/POST /api/admin/v1/pages`, `GET/POST /api/admin/v1/reviews/:id/moderate`
- Guest reviews with email verification
- Page body markdown rendering
- AggregateRating in product JSON-LD (requires approved reviews — should be part of W5-4 if time permits)

**AggregateRating in JSON-LD** is recommended as part of the main W5-4 scope when reviews exist — include in `buildProductJsonLd` when `reviewSummary.count > 0`.
