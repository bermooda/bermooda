# Admin design language

Source of truth for bermooda admin list pages and detail/editor pages. Canonical references:

| Pattern | Reference |
| ------- | --------- |
| List (tables) | [`app/routes/admin/products/index.jsx`](../app/routes/admin/products/index.jsx) |
| Detail (editor) | [`app/components/admin/product-editor.jsx`](../app/components/admin/product-editor.jsx) + [`app/routes/admin/products/$id.jsx`](../app/routes/admin/products/$id.jsx) |

This document replaces the earlier Ghost redesign plan. Apply these patterns when building or migrating any admin page that shows a table, or any admin detail/edit page that should match the products editor.

Primitives live in [`app/components/admin/`](../app/components/admin/). Prefer them over one-off markup.

---

## 1. Principles

1. **Restraint** — flat neutral surfaces, hairline borders, one accent. No decorative gradients, glass, glow, or multi-accent chrome in admin.
2. **Color = meaning** — accent for primary actions and interactive emphasis; `success` / `warn` / `danger` / `neutral` for status only.
3. **Semantic tokens** — use admin tokens from `app/styles/app.css`, not raw `gray-*` / `zinc-*` / `slate-*` / legacy `dark-gradient-*`.
4. **Compose primitives** — `PageHeader`, `Table`, `Toolbar`, `Stat`, `Badge`, `EmptyState`, form controls, etc.
5. **Mobile first-class** — headers stack, secondary columns hide at breakpoints, touch-sized actions.

---

## 2. Tokens

Defined in [`app/styles/app.css`](../app/styles/app.css) (`@theme` + `.dark` overrides). Use Tailwind utilities that map to these:

| Token | Typical utilities | Role |
| ----- | ----------------- | ---- |
| `bg` | `bg-bg` | Page background |
| `surface` | `bg-surface` | Cards, toolbar, sidebar panels |
| `surface-2` | `bg-surface-2`, `hover:bg-surface-2/50` | Inset / hover |
| `border` | `border-border` | Hairline borders |
| `text` | `text-text` | Primary text |
| `text-muted` | `text-text-muted` | Secondary text, meta |
| `accent` | `bg-accent`, `text-accent`, `hover:bg-accent-hover` | Primary CTA, links, focus |
| `accent-fg` | `text-accent-fg` | Text/icons on accent fills |
| `success` / `warn` / `danger` | badge tones, destructive text | Semantic only |

**Do not use in admin:** `dark-gradient-*`, `dark-glass`, `glow-accent*`, `text-gradient-accent`, `accent-gradient`, `dark-mesh-gradient`, or decorative multi-stop brand gradients.

Icons: **Heroicons** only (`@heroicons/react/24/outline` for UI chrome; `/20/solid` for small affordances like breadcrumb chevrons).

---

## 3. List pages (tables)

**Reference:** products index.

### Vertical rhythm

```
PageHeader (title + subtitle + primary action)
→ optional Stat row (summary metrics)
→ Toolbar (search + meta / filters)
→ Table (sticky)  OR  EmptyState
→ Pagination
```

Wrap the page in a plain `<div>` (the admin layout already provides page padding / `bg-bg`).

### PageHeader

```jsx
<PageHeader
  title={…}
  subtitle={…}
  actions={
    <Link
      to="…"
      className="bg-accent text-accent-fg hover:bg-accent-hover focus-visible:outline-accent inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-offset-2"
    >
      <PlusIcon className="h-4 w-4" />
      {…}
    </Link>
  }
/>
```

- Title: resource plural (“Products”).
- Subtitle: one short supporting sentence.
- Actions: primary create CTA (accent fill + icon). Use `Button` / `Link` with the same visual weight as products.

### Stats (optional)

When the list has useful totals, show a responsive grid above the toolbar:

```jsx
<div className="mb-6 grid gap-3 sm:grid-cols-3">
  <Stat label="…" value={…} />
  …
</div>
```

Use `Stat` only for high-level counts — not filters.

### Toolbar

```jsx
<Toolbar className="border-border mb-4 rounded-xl border shadow-xs sm:px-4">
  <SearchField
    defaultValue={q}
    placeholder={…}
    formClassName="w-full sm:max-w-sm"
  />
  <ToolbarGroup>
    <span className="text-text-muted text-sm">{/* result count */}</span>
  </ToolbarGroup>
</Toolbar>
```

- Full rounded border when paired with a sticky (page-aligned) table.
- Left: `SearchField` (GET form, `q` param). Right: result count and/or filter controls via `ToolbarGroup`.
- Keep filters compact; stack on mobile (`Toolbar` already does `flex-col` → `sm:flex-row`).

### Table — sticky variant (preferred for resource lists)

```jsx
<Table variant="sticky" className="mt-2">
  <THead sticky>
    <tr>
      <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">Primary</Th>
      <Th sticky className="px-3 py-3.5">Status</Th>
      <Th sticky className="hidden px-3 py-3.5 sm:table-cell">…</Th>
      {/* … */}
      <Th sticky className="py-3.5 pr-1 pl-3 sm:pr-0">
        <span className="sr-only">Edit</span>
      </Th>
    </tr>
  </THead>
  <TBody sticky>
    {rows.map((row) => (
      <Tr
        key={row.id}
        role="link"
        tabIndex={0}
        className="group cursor-pointer"
        onClick={() => navigate(`/admin/…/${row.id}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate(`/admin/…/${row.id}`);
          }
        }}
      >
        <Td sticky className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0">
          <span className="block min-w-0">
            <span className="group-hover:text-accent block truncate font-medium transition-colors">
              {primaryLabel}
            </span>
            <span className="text-text-muted mt-0.5 block truncate font-mono text-xs font-normal">
              {secondaryMeta}
            </span>
          </span>
        </Td>
        {/* status, counts, dates, trailing edit link */}
      </Tr>
    ))}
  </TBody>
</Table>
```

**Sticky table rules**

| Rule | Detail |
| ---- | ------ |
| Variant | `Table variant="sticky"` + `sticky` on `THead` / `TBody` / `Th` / `Td` |
| No overflow ancestor | Sticky pins to the viewport; do not wrap in `overflow-hidden` / `overflow-x-auto` |
| Primary column | Title (medium) + muted mono secondary (slug / id prefix) |
| Row click | Whole row navigates to detail; keyboard Enter/Space; trailing `Link` uses `stopPropagation` |
| Hover | Primary label → `group-hover:text-accent`; row uses built-in hover surface |
| Responsive columns | Hide secondary cols with `hidden sm:table-cell` / `md:` / `lg:` |
| Numbers / dates | `tabular-nums`; dates like `MMM D, YYYY` |
| Status | `Badge` tones — e.g. published → `success`, draft → `neutral` |
| Tags / categories | `Badge tone="accent"`; empty → muted `—` |
| Trailing action | Accent text link (“Edit”) + `sr-only` resource name |

**Default table variant** (`variant="default"`) — contained bordered surface with horizontal scroll. Use for nested/small tables inside detail sections (e.g. variant price grids), not for primary resource indexes.

### Empty state

When `rows.length === 0`:

```jsx
<EmptyState
  icon={CubeIcon /* domain Heroicon */}
  title={…}
  description={q ? /* no search hits */ : /* no records yet */}
  action={!q && /* primary create CTA */}
/>
```

Differentiate search-empty vs truly empty. Only show create CTA when not searching.

### Pagination

```jsx
<Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
```

Place below the table. Component hides itself when `totalPages <= 1`. Drive page via search params (same pattern as products).

### List page checklist

- [ ] `PageHeader` + primary create action
- [ ] Optional `Stat` row for totals
- [ ] `Toolbar` + `SearchField` + result count
- [ ] Sticky `Table` or `EmptyState`
- [ ] Row → detail navigation (click + keyboard)
- [ ] `Badge` for status / tags
- [ ] `Pagination` when needed
- [ ] i18n via `useT()` — no hard-coded user-facing strings
- [ ] Semantic tokens only

---

## 4. Detail / editor pages

**Reference:** product editor.

### Layout shell

```jsx
<div className="mx-auto max-w-5xl">
  <PageHeader breadcrumbs={…} title={…} subtitle={…} actions={…} />
  {/* alerts */}
  <Form …>
    <div className="space-y-12">
      <FormSection …>…</FormSection>
      {/* more sections; last section uses last */}
    </div>
  </Form>
  {/* footer: destructive left, cancel + save right */}
</div>
```

- Constrain width with `mx-auto max-w-5xl` for readable forms on wide screens.
- Route modules stay thin: load data in `loader` / mutate in `action`, render a dedicated editor component from `#/components/admin/`.

### PageHeader on detail

```jsx
<PageHeader
  breadcrumbs={
    <Breadcrumbs
      items={[
        { label: listTitle, href: '/admin/…' },
        { label: currentTitle },
      ]}
    />
  }
  title={displayTitle}
  subtitle={/* status badge + meta, e.g. created date */}
  actions={/* optional secondary publish / status toggle */}
/>
```

- Breadcrumbs: list → current (current has no `href`).
- Title: entity display name (or “New …” on create).
- Subtitle: compact meta row (status `Badge` + muted date), not a long description.
- Header actions: secondary workflow (publish / unpublish), not the primary Save — Save lives in the footer.

### Form sections (two-column)

Match the Tailwind UI “form layout” used in the product editor:

```jsx
function FormSection({ title, description, children, last = false }) {
  return (
    <div
      className={clsx(
        'grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3',
        !last && 'border-border border-b pb-12'
      )}
    >
      <div>
        <h2 className="text-text text-base/7 font-semibold">{title}</h2>
        {description ? (
          <p className="text-text-muted mt-1 text-sm/6">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0 md:col-span-2">{children}</div>
    </div>
  );
}
```

- Sections stack with `space-y-12`.
- Left column: section title + short description.
- Right column (`md:col-span-2`): fields; nest field grids with `max-w-2xl` / `sm:grid-cols-6` as in products.
- Last section: pass `last` to drop the bottom border.
- Prefer extracting a shared `FormSection` into `#/components/admin/` when a second editor needs it; until then, copy this exact structure.

### Fields

Use admin form primitives:

| Need | Component |
| ---- | --------- |
| Label + control + hint/error | `Field` |
| Text | `Input` |
| Multiline | `Textarea` |
| Select | `Select` |
| URL slug | `SlugField` |
| SEO title/description | `SeoFields` |
| Locale switching | `LocaleTabs` |

Field grids inside a section typically use:

```text
grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6
```

with `Field className="sm:col-span-4"` / `col-span-full` as appropriate.

### Nested tables inside detail

For option/variant/price grids, use native table markup or `Table` **default** variant + `Th` helpers — not the sticky list-page pattern. Keep numeric columns `tabular-nums`; header cells use sticky/`Th` styling consistent with nearby admin tables.

### Alerts

After mutations, show feedback above the form:

- Success → `SuccessAlert`
- Error → `ErrorAlert` (`actionData.error`)

### Footer actions

Products uses a non-sticky footer (preferred default for detail pages):

```jsx
<div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
  {/* left: destructive */}
  <button type="submit" className="text-danger hover:text-danger/80 text-sm/6 font-semibold …">
    Delete
  </button>
  <div className="flex items-center gap-x-6">
    <Link to={listPath} className="text-text text-sm/6 font-semibold …">
      Cancel
    </Link>
    <ButtonSubmit form="…-form" disabled={isSaving}>
      {isSaving ? 'Saving…' : 'Save'}
    </ButtonSubmit>
  </div>
</div>
```

| Position | Action |
| -------- | ------ |
| Left | Destructive (delete) — text-only `danger`, confirm before submit |
| Right | Cancel (text link back to list) + primary `ButtonSubmit` Save/Create |

`ActionBar` (`#/components/admin/action-bar`) is available when a sticky frosted footer is needed; default new editors to the products footer unless sticky save is required.

### Create vs edit

- Same editor component with `mode="create" | "edit"`.
- Create: no delete; may disable media / dependent sections with a clear message.
- Edit: breadcrumbs show entity title; publish toggle allowed in header actions.

### Detail page checklist

- [ ] `max-w-5xl` centered shell
- [ ] `PageHeader` + `Breadcrumbs`
- [ ] Two-column `FormSection` stack (`space-y-12`, bordered between sections)
- [ ] Admin `Field` / `Input` / `Textarea` / etc.
- [ ] Success/error alerts from `actionData`
- [ ] Footer: delete (edit) · cancel · save
- [ ] Thin route + editor component in `#/components/admin/`
- [ ] i18n + semantic tokens

---

## 5. Component map

| Component | Path | Use on |
| --------- | ---- | ------ |
| `PageHeader` | `page-header.jsx` | Every list + detail |
| `Breadcrumbs` | `breadcrumbs.jsx` | Detail / nested |
| `Stat` | `stat.jsx` | List summary metrics |
| `Toolbar` / `ToolbarGroup` | `toolbar.jsx` | List filters/search |
| `SearchField` | `search-field.jsx` | List search |
| `Table`, `Th`, `Td`, `Tr`, `THead`, `TBody` | `table.jsx` | Lists (`sticky`); nested (`default`) |
| `Badge` | `badge.jsx` | Status + tags |
| `EmptyState` | `empty-state.jsx` | Zero-data lists |
| `Pagination` | `pagination.jsx` | Paged lists |
| `Field` / `Input` / `Textarea` / `Select` | `form/*` | Detail forms |
| `SlugField` / `SeoFields` / `LocaleTabs` | respective files | Localized content editors |
| `ActionBar` | `action-bar.jsx` | Optional sticky editor footer |
| `Button` / `ButtonSubmit` | `#/components/ui/button` | Primary/secondary actions |
| `SuccessAlert` / `ErrorAlert` | `#/components/ui/alert` | Mutation feedback |
| `Card` | `card.jsx` | Non-table panels when a surface container is needed |

---

## 6. Do / don’t

**Do**

- Match products list / product editor structure before inventing a new layout.
- Use sticky tables for primary resource indexes.
- Hide secondary columns at `sm` / `md` / `lg` instead of forcing full-page horizontal scroll.
- Keep primary CTAs on `bg-accent text-accent-fg`.
- Use `Badge` tones for meaning (`success`, `neutral`, `accent`, `warn`, `danger`).

**Don’t**

- Build ad-hoc tables with `gray-*` / gradient classes.
- Put Save in the page header (header = title/meta/secondary workflow).
- Wrap sticky tables in overflow containers.
- Use cards in the hero of a list page — stats + toolbar + table is the composition.
- Mix `zinc`/`slate` with semantic tokens on the same page.

---

## 7. Migration notes

When updating an existing admin page:

1. Identify list vs detail.
2. Replace inline header/table/form chrome with the primitives above.
3. Swap colors to semantic tokens.
4. Verify light + dark, and ~360px / 768px / 1280px widths.
5. Keep route loaders/actions thin; move editor UI into `#/components/admin/` when it grows past a simple form.

Related shell/theming infrastructure (unchanged by this doc): [`app/routes/admin/_layout.jsx`](../app/routes/admin/_layout.jsx), [`app/hooks/use-color-mode.jsx`](../app/hooks/use-color-mode.jsx), [`app/utils/theme.server.js`](../app/utils/theme.server.js).
