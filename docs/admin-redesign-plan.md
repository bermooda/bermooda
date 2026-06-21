# bermooda — Admin Area Redesign Plan (Ghost-inspired, dark + light)

## Context

Redesign the bermooda **admin back office** (`/admin/*`) to feel modern and close to the [Ghost](https://ghost.org) blogging platform's admin, with first-class **dark and light** modes and full **mobile optimisation**. This is a UI/UX and design-system refactor of the admin surface only — the storefront (themed) and the REST API are out of scope.

The plan is grounded in the current code: the admin shell lives in [`app/routes/admin/_layout.jsx`](../app/routes/admin/_layout.jsx), design tokens in [`app/styles/app.css`](../app/styles/app.css), and theming infra in [`app/hooks/use-theme.jsx`](../app/hooks/use-theme.jsx) + [`app/utils/theme.server.js`](../app/utils/theme.server.js).

---

## 1. Design intent — what "Ghost-like" means

Ghost's admin (including its 2026 "new admin shell") is built on one discipline: **restraint**. These principles are notably the *opposite* of bermooda's current violet/fuchsia gradient + glow + glassmorphism dark theme.

| Principle | Ghost | bermooda today |
| --- | --- | --- |
| Accent | **One** color, max saturation, only on interactive elements | Multi-accent (cyan/violet/fuchsia gradients) |
| Surfaces | Flat neutral; base + one surface step | Gradients (`dark-gradient-*`), glass, glow |
| Base | Near-white `#FAFAFA` / near-black `#111` | `bg-gray-50` / purple-tinted `oklch` `dark-950` |
| Borders | Hairline, low-contrast | Mixed (`ring`, gradient borders) |
| Typography | Inter, high-contrast text + muted secondary | Inter (keep) |
| Color usage | Decoration-free; color = meaning | Decorative gradients everywhere |

**Net direction:** strip decorative gradients/glow/mesh from the admin, introduce a single accent, flatten surfaces into a clean neutral two-tone system, and unify the inconsistent `gray-*` / `zinc-*` / `slate-*` / `dark-*` palettes behind semantic tokens that resolve in both themes.

---

## 2. Scope & guiding constraints

- **In scope:** the authenticated admin shell ([`app/routes/admin/_layout.jsx`](../app/routes/admin/_layout.jsx)), admin auth pages, admin design tokens, and a small set of reusable admin UI primitives the route pages can adopt.
- **Theme:** reuse the existing, working theming infra (`#/hooks/use-theme`, `app/utils/theme.server.js`, `.dark` class, SSR cookie). No new theme engine — only new tokens + classes.
- **Repo constraints:** JS/JSX only, Tailwind v4 CSS-first config in `app/styles/app.css`, `#/*` imports without extensions, Heroicons (already the only icon set), smallest change that fully solves the task, prefer existing patterns.
- **Migration safety:** the redesign is additive at the token level so the ~30 monolithic route pages keep working while migrated incrementally.

---

## 3. Design tokens (the foundation) — `app/styles/app.css`

Introduce a **semantic token layer** in `@theme` that both themes resolve, so pages stop hardcoding `gray-50` / `dark-950` etc.

Proposed token set (names illustrative):

```text
--color-bg            page background        light #FAFAFA  / dark #101114
--color-surface       cards, sidebar         light #FFFFFF  / dark #16181D
--color-surface-2     inset, hover           light #F4F4F5  / dark #1E2026
--color-border        hairline borders       light #E6E6E8  / dark #2A2D34
--color-text          primary text           light #15171A  / dark #F5F6F7
--color-text-muted    secondary text         light #6B7177  / dark #9CA3AF
--color-accent        single brand accent    Ghost-style green (~oklch 0.72 0.17 150)
--color-accent-fg     text on accent         near-black/white for contrast
--color-success/-warn/-danger  semantic only (badges, alerts)
```

Implementation approach:

- Define light values as the default in `@theme`; override the same custom properties under `.dark { ... }`.
- Reference them via Tailwind v4 color utilities (`bg-bg`, `bg-surface`, `text-text`, `border-border`, `bg-accent`).
- **Remove from admin usage** (keep defined elsewhere if the landing/marketing surfaces still use them): `dark-gradient-*`, `dark-glass`, `glow-accent*`, `text-gradient-accent`, `accent-gradient`, `dark-mesh-gradient`.
- Fix undefined `surface-950` / `surface-700` classes referenced in `verify-2fa.jsx` / `otp-input.jsx`.
- Keep Inter.

Decision: default the accent to **Ghost-style green**. Easy to swap later since it is one token.

---

## 4. Reusable admin UI primitives — `app/components/admin/`

Today nearly all admin UI is inlined in route files; there is no shared Card/Table/Input/Badge. Add a small primitive set (new folder `app/components/admin/`, lowercase-hyphen files, PascalCase exports). All are presentation-only per the component rules.

| Component | File | Purpose |
| --- | --- | --- |
| `PageHeader` | `page-header.jsx` | Title + subtitle + actions row (Ghost-style page top) |
| `Card` / `CardSection` | `card.jsx` | Neutral surface container with hairline border |
| `Table` | `table.jsx` | Styled, responsive wrapper for the many native `<table>`s |
| `Badge` | `badge.jsx` | Status pills (success/warn/danger/neutral) |
| `Input`, `Select`, `Textarea`, `Field` | `form/*.jsx` | Form controls with a consistent accent focus ring |
| `Button` | extend `app/components/ui/button.jsx` | Add `primary`/`secondary`/`ghost`/`danger` variants using the accent token (drop `accent-gradient`) |
| `EmptyState` | `empty-state.jsx` | Consistent empty/zero-data states |

Route modules opt in over time.

---

## 5. The admin shell redesign — `app/routes/admin/_layout.jsx`

Rework the chrome to match Ghost's new shell while keeping current behavior (auth loader, i18n, locale menu, theme toggle, mobile drawer).

- **Sidebar**
  - Flat neutral `surface` background (no `dark-gradient-subtle`), single hairline right border.
  - **Group the 22-item flat list** into Ghost-like sections to reduce overwhelm:
    - *Overview* — Dashboard, Reports, Audit Log
    - *Catalog* — Products, Categories, Inventory, Price Lists
    - *Content* — Pages, Menus, Reviews
    - *Sales* — Orders, Discounts, Gift Cards
    - *Customers* — Customers, Customer Groups, Loyalty
    - *Growth* — Marketing, Channels
    - *Configuration* — Themes, Plugins, API, Settings
  - Convert `NAV_ITEMS` into a grouped config array (in-file, optionally extracted to `nav-items.js`).
  - Active state: subtle `surface-2` fill + accent indicator/icon (single accent, not violet+fuchsia split).
- **Topbar**
  - Flatten (no backdrop gradient), hairline bottom border.
  - Either wire the currently-dead search to a basic admin search or demote it to a non-misleading state (recommend: command-style trigger; full search is a follow-up).
  - Keep locale menu + theme toggle; restyle dropdowns off `dark-glass` onto flat `surface` + border.
- **User menu:** restyle off glass; keep theme toggle / storefront / logout.
- **Content area:** `bg-bg`, generous padding, max-width container for readability on wide screens.

---

## 6. Mobile optimisation (first-class, not an afterthought)

Ghost's admin is fully usable on phones; the redesign must match. The current layout already has a mobile drawer (`MobileSidebar`) and `md:` breakpoints — this section keeps and strengthens that across every touched surface.

**Layout & navigation**

- Keep the slide-in drawer (`MobileSidebar`) + backdrop pattern; restyle to flat `surface` with the grouped nav. Ensure the drawer is scrollable when groups overflow and closes on route change.
- Keep the desktop fixed sidebar hidden below `md` (`md:ml-64` offset only applies at `md+`).
- Topbar stays sticky and compact (`h-14`); hamburger remains visible only below `md`. Collapse the search into an icon/expandable field on small screens so it never crowds the locale/theme actions.

**Touch & ergonomics**

- Interactive targets (nav links, buttons, menu items, toggles) sized for touch — minimum ~40px hit area; adequate spacing to avoid mis-taps.
- Dropdowns/menus (locale, user) anchor within the viewport on mobile and are dismissable by tapping the backdrop.

**Responsive content primitives**

- `PageHeader`: title + actions stack vertically on small screens, row on `sm+`; actions wrap rather than overflow.
- `Table`: responsive strategy for the many admin tables — horizontal scroll within a contained wrapper by default, and a card/stacked layout for key list pages (orders, products, customers) on narrow viewports. No full-page horizontal scroll.
- `Card`/form fields: full-width single column on mobile, multi-column grids only at `sm`/`md+`.
- Filter forms (`<Form method="get">`) collapse into a compact, stacked layout on mobile.

**Verification**

- Test the shell, dashboard, a list page, a detail/form page, and auth pages at representative widths (~360px, 768px, 1024px, 1440px) in both light and dark mode.
- Confirm no horizontal page overflow, readable text sizes, and reachable primary actions on small screens.

---

## 7. Auth pages (login, forgot/reset, 2FA)

- Replace `dark-mesh-gradient` in [`app/components/auth/auth-layout.jsx`](../app/components/auth/auth-layout.jsx) with a clean centered card on neutral `bg`.
- Update `app/components/ui/alert.jsx`, `button.jsx`, `otp-input.jsx` to semantic tokens; fix undefined `surface-*` classes.
- Ensure auth cards are comfortably centered and full-width-friendly on mobile.

---

## 8. Dark/light mode polish

- Verify every new token has both light and dark values; confirm no `dark:`-only color leaves light mode unstyled.
- Keep the two existing toggles (topbar + user menu); optionally consolidate by reusing [`app/components/ui/theme-toggle.jsx`](../app/components/ui/theme-toggle.jsx) instead of duplicated inline logic.
- Re-test the FOUC-prevention inline script path in [`app/root.jsx`](../app/root.jsx) against the new tokens.

---

## 9. Incremental page migration

Shell + tokens + primitives land first (immediate visible win). Then migrate route pages from inline ad-hoc classes to primitives, prioritised by visibility/complexity:

1. `dashboard.jsx`, `reports/index.jsx` (metric cards → unified `Card`/`Badge`)
2. List pages: `products`, `orders`, `customers`, `categories`, `discounts` (→ `Table`, `PageHeader`, `Badge`, mobile card layout)
3. Detail/edit pages: `products/$id`, `orders/$id` (→ `Card`, form primitives)
4. `settings/index.jsx`, `api-settings.jsx` (tabs + forms)
5. Remaining pages + retire dead components (`components/dashboard/*`, `components/sidebar/*` if confirmed unused).

Each page migration is independent and low-risk.

---

## 10. Validation (per repo PR-preflight rules)

- `npm run lint` (oxlint + `oxfmt --check`; run `npm run fmt` if needed)
- `npm run build`
- `npm run test` (touched areas)
- Manual smoke via `npx react-router dev --port 3000 --host`: toggle dark/light on the shell, dashboard, a list page, a form page, and auth pages — at mobile and desktop widths.

---

## 11. Suggested PR breakdown

- **PR 1 — Foundation:** semantic tokens in `app.css` + admin primitives in `app/components/admin/` + Button variants. No visual change to pages yet.
- **PR 2 — Shell:** redesigned `_layout.jsx` (grouped sidebar, flat topbar, dropdowns, mobile drawer polish) + auth pages.
- **PR 3..n — Page migrations:** batched by section (catalog, sales, etc.), each including mobile-responsive table/layout work.

This keeps each PR reviewable and independently shippable, with the high-impact look-and-feel change (PR 1 + 2) landing early.

---

## Open decisions (defaults assumed unless changed)

1. **Accent color:** default Ghost-style **green**. Swap to a brand color if desired.
2. **Sidebar grouping:** adopt the 7 groups above, or keep a flat (restyled) list.
3. **Dead/legacy code** (`components/dashboard/*`, `components/sidebar/*`, gradient/glow CSS): remove during this work, or defer to a separate cleanup.
4. **Topbar search:** wire a basic search now, or restyle-only and defer functionality.
