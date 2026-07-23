# Theme System

This document covers the bermooda theme system for developers building or customizing storefront themes.

---

## Overview

Themes control the visual presentation of the storefront. Each theme is a folder under `app/themes/<name>/` that exports a manifest object, a set of React components, and optionally i18n translations and route mappings.

The theme engine has three responsibilities:

1. **Validation** — `defineTheme` checks manifests at startup and throws on any structural problem.
2. **Registration** — `registerTheme` loads validated manifests into an in-memory registry keyed by theme `id`.
3. **Resolution** — `resolveActiveTheme` reads the `activeTheme` setting from the database (TTL-cached for 5 minutes) and returns the matching manifest from the registry.

All theme engine code lives in `app/core/themes/index.server.js`. The module is server-only; never import it in client bundles.

---

## Theme Manifest Structure

A manifest is a plain JavaScript object with the following shape:

```js
export default {
  id: 'my-theme', // required — unique string identifier
  name: 'My Theme', // required — human-readable display name
  version: '1.0.0', // required — semver string
  description: '...', // optional — shown in the admin themes list
  components: {
    // required — map of component name → component
    Layout,
    HomePage,
    ProductPage,
    CategoryPage,
    CartPage,
    CheckoutLayout,
    NotFoundPage,
    // ... additional optional components
  },
  settings: [
    // optional — manifest-driven admin settings
    {
      key: 'accentColor',
      label: 'Accent Color',
      type: 'text',
      default: '#6366f1',
    },
    { key: 'darkMode', label: 'Dark Mode', type: 'toggle', default: false },
    {
      key: 'layout',
      label: 'Layout Style',
      type: 'select',
      options: ['wide', 'boxed'],
      default: 'wide',
    },
  ],
};
```

### Required fields

| Field        | Type     | Description                                                                            |
| ------------ | -------- | -------------------------------------------------------------------------------------- |
| `id`         | `string` | Unique theme identifier. Used as the registry key and stored in `Setting.activeTheme`. |
| `name`       | `string` | Display name shown in the admin themes UI.                                             |
| `version`    | `string` | Version string (semver recommended).                                                   |
| `components` | `object` | Map of component names to React components. Must include all required components.      |

### Required components

Every theme must supply all seven of the following components in its `components` map. `defineTheme` throws if any are absent.

| Component name   | Where it renders                                              |
| ---------------- | ------------------------------------------------------------- |
| `Layout`         | Root shell wrapping every storefront page (nav, footer, etc.) |
| `HomePage`       | `/` — the storefront home page                                |
| `ProductPage`    | `/products/:slug` — single product detail page                |
| `CategoryPage`   | `/categories/:slug` — product listing for a category          |
| `CartPage`       | `/cart` — shopping cart                                       |
| `CheckoutLayout` | `/checkout/:step` — multi-step checkout shell                 |
| `NotFoundPage`   | Rendered when no route matches (404)                          |

### Optional components

The default theme ships additional components that themes may implement. These are resolved on demand via `getStorefrontComponent`; returning `null` from that function is safe if your theme omits them.

| Component name           | Where it renders / purpose                             |
| ------------------------ | ------------------------------------------------------ |
| `CheckoutThankYouPage`   | `/thank-you/:orderNumber` — post-purchase confirmation |
| `ProductCard`            | Reusable card used inside product grids                |
| `ProductGrid`            | Grid layout for lists of `ProductCard` items           |
| `AccountLayout`          | Shell wrapper for all `/account/*` routes              |
| `AccountDashboard`       | `/account` — customer overview                         |
| `AccountOrdersPage`      | `/account/orders` — order history                      |
| `AccountOrderDetailPage` | `/account/orders/:id` — single order detail            |
| `AccountAddressesPage`   | `/account/addresses` — saved address management        |
| `AccountProfilePage`     | `/account/profile` — profile editing                   |
| `LoginPage`              | `/account/login`                                       |
| `RegisterPage`           | `/account/register`                                    |
| `ForgotPasswordPage`     | `/account/forgot-password`                             |
| `ResetPasswordPage`      | `/account/reset-password`                              |
| `LocaleSwitcher`         | UI control for changing the active locale              |
| `CurrencySwitcher`       | UI control for changing the active currency            |

### Theme settings

The optional `settings` array lets themes declare admin-configurable options. Each entry has:

| Key       | Type                             | Description                                                     |
| --------- | -------------------------------- | --------------------------------------------------------------- |
| `key`     | `string`                         | Storage key (prefixed `theme.<id>.<key>` in the settings table) |
| `label`   | `string`                         | Label shown in the admin form                                   |
| `type`    | `'text' \| 'select' \| 'toggle'` | Input type rendered in the admin UI                             |
| `options` | `string[] \| {value,label}[]`    | Choices for `select` type                                       |
| `default` | `any`                            | Fallback value when nothing is saved                            |

---

## Slot Names

Slots are named injection points in the storefront layout where plugins can contribute UI blocks. The full list of well-known slot names is exported as `SLOT_NAMES` from `app/core/themes/index.server.js`.

| Slot name                  | Location in the storefront                                |
| -------------------------- | --------------------------------------------------------- |
| `home.hero`                | Hero area at the top of the home page, above main content |
| `home.featured`            | Featured section on the home page, below the hero         |
| `product.afterDescription` | Below the product description on the product detail page  |
| `product.sidebar`          | Sidebar column on the product detail page                 |
| `category.top`             | Above the product grid on category listing pages          |
| `cart.summary`             | Inside the cart summary panel                             |
| `checkout.afterPayment`    | Below the payment fields in the checkout flow             |
| `account.dashboard`        | Inside the customer account dashboard                     |
| `layout.header`            | Inside the global site header (rendered by `Layout`)      |
| `layout.footer`            | Inside the global site footer (rendered by `Layout`)      |

The default theme renders all 10 of these slots. Route loaders fetch blocks server-side and pass a `slotBlocks` map into the theme component or shell that owns the slot.

Themes render slots by calling `getSlotBlocks(slotName)` or `getSlotBlocksMap(slotNames)` and mounting each returned `{ pluginId, component }` entry. The shared `SlotBlocks` component in `app/components/slot-blocks/index.jsx` accepts optional `slotProps`, which are spread into every plugin block so blocks can receive page-specific data like `product`, `cart`, `category`, or checkout state.

Example:

```jsx
import SlotBlocks from '#/components/slot-blocks/index';

<SlotBlocks
  blocks={slotBlocks['product.afterDescription']}
  slotProps={{ product, locale, currency }}
/>;
```

---

## API Reference

All functions are exported from `app/core/themes/index.server.js`.

---

### `defineTheme(manifest)`

Validates a theme manifest. Throws a `TypeError` if the manifest is not a non-null object. Throws an `Error` if any required field (`id`, `name`, `version`, `components`) is missing or empty, or if any required component is absent from `manifest.components`.

Returns the manifest unchanged on success. Use this when you want to validate a manifest without registering it.

```js
import { defineTheme } from '#/core/themes/index.server';

const manifest = defineTheme({
  id: 'my-theme',
  name: 'My Theme',
  version: '1.0.0',
  components: {
    Layout,
    HomePage,
    ProductPage,
    CategoryPage,
    CartPage,
    CheckoutLayout,
    NotFoundPage,
  },
});
```

---

### `registerTheme(manifest)`

Calls `defineTheme`, then stores the validated manifest in the in-memory registry under `manifest.id`. Logs `Theme registered` at info level. Returns the validated manifest.

Call this at application startup for every bundled theme. Calling `registerTheme` with an `id` that is already registered overwrites the previous entry.

```js
import { registerTheme } from '#/core/themes/index.server';
import manifest from '#/themes/my-theme/manifest.js';

registerTheme(manifest);
```

---

### `resolveActiveTheme()`

Async. Reads `Setting.activeTheme` from the database (cached for 5 minutes under the key `theme:active`). Returns the manifest from the in-memory registry whose `id` matches the stored value, or `null` if the setting is unset or the id is not registered.

```js
import { resolveActiveTheme } from '#/core/themes/index.server';

const theme = await resolveActiveTheme();
if (!theme) {
  // no active theme configured or theme not registered
}
```

**Cache invalidation:** the admin themes action (`/admin/themes`) calls `cache.delete('theme:active')` after writing a new active theme ID, so the change takes effect on the next request rather than waiting for the 5-minute TTL to expire.

---

### `getStorefrontComponent(name)`

Async. Resolves a single component by name from the active theme. Calls `resolveActiveTheme` internally. Returns the component value, or `null` if the active theme is unset or the component name is not in `manifest.components`.

```js
import { getStorefrontComponent } from '#/core/themes/index.server';

const Layout = await getStorefrontComponent('Layout');
```

---

### `getSlotBlocks(slotName)`

Async. Returns an ordered array of `{ pluginId: string, component: unknown }` objects for the given slot, ordered by `Setting.pluginOrder`. The plugin order setting is TTL-cached (5 minutes, key `setting:pluginOrder`).

```js
import { getSlotBlocks } from '#/core/themes/index.server';

const blocks = await getSlotBlocks('home.hero');
for (const { pluginId, component: Block } of blocks) {
  // render <Block key={pluginId} />
}
```

---

### `getSlotBlocksMap(slotNames)`

Async. Returns an object keyed by slot name where each value is the ordered block array for that slot. Use this when a loader needs to hydrate multiple slots in one pass and pass a consistent `slotBlocks` map to the theme.

```js
import { getSlotBlocksMap } from '#/core/themes/index.server';

const slotBlocks = await getSlotBlocksMap(['layout.header', 'layout.footer']);
```

---

### `SLOT_NAMES`

Array of the 10 well-known slot name strings. Import this when you need to validate a slot name or enumerate all slots.

```js
import { SLOT_NAMES } from '#/core/themes/index.server';
```

---

## Creating a Custom Theme by Forking the Default

The simplest way to build a new theme is to copy the default theme folder and modify it incrementally.

### Step 1 — Copy the default theme folder

```
cp -r app/themes/default app/themes/aurora
```

### Step 2 — Update the manifest

Open `app/themes/aurora/manifest.js`. Change `id` and `name` to match your theme. The `id` must be unique across all registered themes.

```js
// app/themes/aurora/manifest.js
export default {
  id: 'aurora',
  name: 'Aurora',
  version: '1.0.0',
  description: 'A custom theme forked from the default.',
  components: {
    Layout,
    HomePage,
    // ... all other imports unchanged until you replace them
  },
};
```

### Step 3 — Implement required components

At minimum you must implement all seven required components. The copied files from the default theme are already valid implementations — start by editing them rather than writing from scratch.

The required components are located at:

```
app/themes/aurora/components/layout.jsx
app/themes/aurora/components/home-page.jsx
app/themes/aurora/components/product-page.jsx
app/themes/aurora/components/category-page.jsx
app/themes/aurora/components/cart-page.jsx
app/themes/aurora/components/checkout-layout.jsx
app/themes/aurora/components/not-found-page.jsx
```

Optional components you do not intend to customize can be left as copied from the default, or removed from the manifest if they are not needed.

### Step 4 — Update i18n translations (optional)

If you want to ship custom translation strings, edit `app/themes/aurora/i18n/en.json`. The theme i18n keys follow the same format used by the default theme. Add additional locale files as needed (e.g. `de.json`, `fr.json`).

### Step 5 — Register the theme at startup

Import the manifest and call `registerTheme` early in your server initialization. The right place is wherever you register other startup-time resources (for example, alongside plugin registrations).

```js
import { registerTheme } from '#/core/themes/index.server';
import auroraManifest from '#/themes/aurora/manifest.js';

registerTheme(auroraManifest);
```

Both the `default` and `aurora` themes can be registered simultaneously. The active theme is determined by the database setting, not by registration order.

### Step 6 — Activate the theme

See the next section for how to activate your theme via the admin UI or the database seed.

---

## Switching the Active Theme

### Via the admin UI

Navigate to `/admin/themes`. Every registered theme is displayed as a card. Click **Activate** on the theme you want to make active. The action writes the theme `id` to `Setting.activeTheme` and immediately invalidates the in-memory cache (`theme:active`), so the storefront picks up the new theme on the next request.

If the admin UI shows a warning that "the active theme ID is set to X but no matching theme is registered", the theme has not been registered at startup. Register it (Step 5 above) and restart the server.

### Via the database seed

For local development or CI environments, set the active theme directly in `prisma/seed.js`:

```js
await upsertSetting('activeTheme', 'aurora');
```

Then re-run the seed:

```
npx prisma db seed
```

The TTL cache will expire within 5 minutes, or restart the dev server to pick up the change immediately.

---

## Notes and Constraints

- **Server-only module.** `app/core/themes/index.server.js` must never be imported in client code. The `.server.js` suffix enforces this in React Router / Vite builds.
- **In-memory registry.** The registry is process-local. In a multi-process deployment (e.g. multiple Node workers) every process registers themes independently at startup from the same source files, so the registry is consistent across processes without any shared state.
- **No npm-package themes in v1.** Themes must live under `app/themes/<name>/` as local folders. External theme packages installed via npm are not supported in the current version.
- **TTL cache window.** After an admin activates a theme, storefronts that have already cached the previous active theme ID will continue to serve the old theme for up to 5 minutes. The admin action busts the cache for the current process immediately; other processes will observe the change when their cache TTL expires.
- **Testing.** The `__resetRegistry()` export is provided exclusively for test teardown. Do not call it in production code.
