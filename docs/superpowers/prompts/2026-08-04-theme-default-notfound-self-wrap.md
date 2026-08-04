# Prompt: theme-default NotFoundPage self-wrap

Copy everything below the line into a Cursor Cloud / agent session opened on **`bermooda/theme-default`** (not bermooda/bermooda).

---

## Task

Make `NotFoundPage` own storefront chrome by wrapping itself in `StorefrontShell`, matching every other theme page. This is the companion to bermooda PR [#188](https://github.com/bermooda/bermooda/pull/188) (Phase A Layout ownership): bermooda’s `routes/404.jsx` no longer wraps theme `Layout`, so without this change published installs render a chrome-less 404.

## Repo / branch

- Repo: `https://github.com/bermooda/theme-default`
- Base branch: `main`
- Create: `cursor/notfound-self-wrap-layout` (or your usual prefix)
- Package: `@bermooda/theme-default`

## Why

In bermooda, theme page components **self-wrap** `Layout` / `StorefrontShell`. The 404 route now does:

```js
return <NotFoundPage {...data} />;
```

It must not resolve/wrap `Layout` itself. `NotFoundPage` in this theme currently returns bare content (no shell). Other pages already wrap — copy that pattern.

## What to change

**File:** `components/not-found-page.jsx`

1. Import `StorefrontShell` from `./storefront-chrome` (relative sibling import — same as `page-page.jsx`, `home-page.jsx`, `cart-page.jsx`, etc.).
2. Wrap the existing JSX tree in `<StorefrontShell>…</StorefrontShell>`.
3. Do **not** change copy, links, classes, or i18n keys.
4. Keep `#/core/i18n` and `#/libs/config` imports as they are (reorder only if needed for local style).

**Reference pattern** (`components/page-page.jsx`):

```js
import StorefrontShell from './storefront-chrome';

export default function PagePage({ page }) {
  return (
    <StorefrontShell>
      {/* page content */}
    </StorefrontShell>
  );
}
```

**Target shape for `NotFoundPage`:**

```js
import { Link } from 'react-router';

import { useT } from '#/core/i18n';
import config from '#/libs/config';

import StorefrontShell from './storefront-chrome';

const accountHome = config.auth.customerCallbackUrl;

export default function NotFoundPage() {
  const t = useT();

  return (
    <StorefrontShell>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        {/* existing inner content unchanged */}
      </div>
    </StorefrontShell>
  );
}
```

## Do not

- Change other pages (they already self-wrap).
- Add React context, props plumbing, or bermooda core changes.
- Bump version unless this repo’s release process requires it (follow existing Conventional Commits / release-please conventions in this package).
- Introduce a second Layout wrapper or nest shells.

## Validate

```bash
npm run lint   # or the package’s equivalent
# Visual check once installed into a bermooda shop:
# hit a missing storefront URL — header/footer chrome must render once (no double chrome)
```

## Commit + PR

```text
fix(theme): self-wrap NotFoundPage with StorefrontShell
```

PR body should mention:

- Companion to bermooda#188 (Layout ownership / 404)
- Without this, 404 has no nav/footer after bermooda merges
- Merge/publish this theme **before or with** bermooda#188

## Done when

- [ ] `components/not-found-page.jsx` wraps content in `StorefrontShell`
- [ ] Lint/format clean
- [ ] PR opened against `main`
- [ ] (After merge) theme released or sibling-installed so bermooda#188 can merge safely
