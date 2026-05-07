# Plugin System

This document describes the bermooda plugin architecture and serves as the reference for developers building plugins.

---

## Table of Contents

1. [Overview](#overview)
2. [Plugin Manifest](#plugin-manifest)
3. [API Reference](#api-reference)
4. [The ctx Object](#the-ctx-object)
5. [Event Hook Catalog](#event-hook-catalog)
6. [Plugin Data Storage](#plugin-data-storage)
7. [Admin Routes](#admin-routes)
8. [Plugin Blocks for Storefront Slots](#plugin-blocks-for-storefront-slots)
9. [Sample Plugin Walkthrough](#sample-plugin-walkthrough)
10. [Plugin Folder Layout](#plugin-folder-layout)

---

## Overview

Plugins extend the bermooda platform without modifying core code. Each plugin is a self-contained directory under `app/plugins/<plugin-id>/` that declares a manifest, registers event hook handlers, optionally contributes admin pages, and optionally renders UI blocks into storefront slots.

The plugin lifecycle is:

1. **Define** — the plugin calls `definePlugin(manifest)` at module load time to validate its manifest.
2. **Register** — `register(manifest)` adds the plugin to the in-memory registry. This is typically done at application startup when the plugin's `index.server.js` is imported.
3. **Enable** — `enable(pluginId)` persists the enabled state, wires hook handlers onto the event bus, and calls the plugin's `onEnable` lifecycle hook.
4. **Disable** — `disable(pluginId)` calls `onDisable`, removes hook handlers from the event bus, and persists the disabled state.

All plugin infrastructure lives in `app/core/plugins/index.server.js`.

---

## Plugin Manifest

A manifest is a plain JavaScript object that describes the plugin to the platform.

```js
{
  id: 'my-plugin',           // string, required — globally unique identifier
  name: 'My Plugin',         // string, required — human-readable display name
  version: '1.0.0',          // string, required — semver version string
  description: '...',        // string, optional — short description shown in admin
  hooks: { ... },            // object, optional — event handler map (see defineHooks)
  providers: { ... },        // object, optional — payment/shipping/tax provider specs
  adminRoutes: './admin/routes.js', // string, optional — path to admin routes file
  onEnable: async (ctx) => {},     // function, optional — called when plugin is enabled
  onDisable: async (ctx) => {},    // function, optional — called when plugin is disabled
}
```

### Field Reference

| Field         | Type           | Required | Description                                                                                                      |
| ------------- | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`          | string         | yes      | Unique plugin identifier. Used as namespace key for PluginData and settings. Must be non-empty.                  |
| `name`        | string         | yes      | Display name shown in the admin UI. Must be non-empty.                                                           |
| `version`     | string         | yes      | Plugin version. Must be non-empty. Semver recommended.                                                           |
| `description` | string         | no       | Short description of what the plugin does.                                                                       |
| `hooks`       | object         | no       | Map of event names to handler functions. Pass through `defineHooks()`.                                           |
| `providers`   | object         | no       | Map of provider specs. Each value should be created with `defineProvider()`.                                     |
| `adminRoutes` | string         | no       | Relative path (from the plugin root) to the admin routes file. Enables an admin page at `/admin/plugins/<id>/*`. |
| `onEnable`    | async function | no       | Called with `ctx` after hook handlers are registered. Use for initialization tasks.                              |
| `onDisable`   | async function | no       | Called with `ctx` before hook handlers are removed. Use for cleanup tasks.                                       |

---

## API Reference

All functions are exported from `app/core/plugins/index.server.js`. Import with the `#/core/plugins/index.server` alias.

### `definePlugin(manifest)`

Validates a plugin manifest and returns it unchanged. Throws if `id`, `name`, or `version` is missing, not a string, or empty.

```js
import { definePlugin } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
});
```

**Throws:** `Error` if any required field is absent or not a non-empty string.

---

### `defineHooks(hookMap)`

Validates that every value in the hook map is a function, then returns the map. Use this when declaring the `hooks` field of your manifest.

```js
import { defineHooks } from '#/core/plugins/index.server';

const hooks = defineHooks({
  'order.created': async (payload) => {
    /* ... */
  },
  'customer.registered': async (payload) => {
    /* ... */
  },
});
```

**Throws:** `Error` if any handler is not a function.

Hook handlers receive the event payload as their only argument. They do not receive `ctx` — if a handler needs access to Prisma or other services it must import them directly (see [sample plugin](#sample-plugin-walkthrough) for a concrete example).

---

### `defineProvider(type, spec)`

Creates a typed provider spec object. Returns `{ type, ...spec }`.

```js
import { defineProvider } from '#/core/plugins/index.server';

const myPaymentProvider = defineProvider('payment', {
  name: 'My Payment Gateway',
  charge: async ({ amountCents, currency, token }) => {
    /* ... */
  },
  refund: async ({ chargeId, amountCents }) => {
    /* ... */
  },
});
```

**Parameters:**

- `type` — must be one of `'payment'`, `'shipping'`, or `'tax'`.
- `spec` — object with provider-specific fields.

**Throws:** `Error` if `type` is not one of the valid values, or if `spec` is not an object.

---

### `register(manifest)`

Adds a validated manifest to the in-memory plugin registry. Internally calls `definePlugin()` again, so validation is always enforced.

```js
import { register } from '#/core/plugins/index.server';
import { pluginManifest } from './index.server.js';

register(pluginManifest);
```

Calling `register()` does not enable the plugin or wire any handlers. Call `enable()` separately to activate the plugin.

---

### `enable(pluginId)`

Enables a registered plugin. This is an async function that:

1. Persists `plugin.<pluginId>.enabled = true` in the `Setting` table.
2. Registers all hook handlers from `manifest.hooks` onto the event bus via `on(event, handler)`.
3. Calls `manifest.onEnable(ctx)` if defined.

```js
import { enable } from '#/core/plugins/index.server';

await enable('my-plugin');
```

**Throws:** `Error` if the plugin is not in the registry.

If the plugin is already enabled (its handlers map is non-empty), `enable()` returns immediately without re-registering or calling `onEnable` again.

---

### `disable(pluginId)`

Disables a registered plugin. This is an async function that:

1. Persists `plugin.<pluginId>.enabled = false` in the `Setting` table.
2. Calls `manifest.onDisable(ctx)` if defined.
3. Removes all hook handlers from the event bus via `off(event, handler)` and clears the handlers map.

```js
import { disable } from '#/core/plugins/index.server';

await disable('my-plugin');
```

**Throws:** `Error` if the plugin is not in the registry.

---

### `loadPlugins()`

Returns a snapshot of the current plugin registry. Useful for admin UIs and diagnostics.

```js
import { loadPlugins } from '#/core/plugins/index.server';

const { plugins, hooks } = loadPlugins();
// plugins — array of all registered PluginManifest objects
// hooks   — { [eventName]: Function[] } of currently active handlers
```

**Returns:** `{ plugins: PluginManifest[], hooks: Record<string, Function[]> }`

Only handlers that were registered via `enable()` and have not yet been removed by `disable()` appear in `hooks`.

---

### `resolvePluginRoute(pluginId, path)`

Resolves an admin route descriptor for a plugin. Currently returns `null`; full implementation arrives in Phase 5.

---

## The ctx Object

`ctx` is passed to `onEnable` and `onDisable` lifecycle hooks. Plugins that need access to platform services in these hooks receive it as the first argument.

```js
{
  db,          // Prisma client — direct access to the full database
  settings,    // platform settings service
  plugin,      // namespaced plugin data store
  logger,      // Pino logger scoped to this plugin
  queue,       // background job queue
  emit,        // event bus emit function
  t,           // i18n translation function
}
```

### `ctx.db`

The Prisma client instance. Provides full ORM access to the application database. Use this when you need to query platform models (orders, customers, products, etc.) in lifecycle hooks.

In v1, plugins cannot define their own Prisma models. All plugin-specific persistence must go through `ctx.plugin` (see [Plugin Data Storage](#plugin-data-storage)).

---

### `ctx.settings`

Access to the platform `Setting` table (TTL-cached reads).

```js
const value = await ctx.settings.get('my-setting-key'); // returns string | null
await ctx.settings.set('my-setting-key', 'some-value');
```

Settings are global and unnamespaced. Plugins should prefix their keys to avoid collisions, for example `my-plugin.apiKey`.

---

### `ctx.plugin`

Namespaced key-value storage scoped to this plugin. All reads and writes target the `PluginData` table, keyed by `pluginId` and `key`. Values are automatically JSON-serialized on write and deserialized on read.

```js
const data = await ctx.plugin.get('myKey'); // returns parsed value or null
await ctx.plugin.set('myKey', { count: 42 }); // upserts, serializes to JSON
await ctx.plugin.delete('myKey'); // deletes the row
```

See [Plugin Data Storage](#plugin-data-storage) for full details.

---

### `ctx.logger`

A [Pino](https://getpino.io/) logger pre-configured with `{ plugin: pluginId }` in the child context. Use this instead of a bare `console.log`.

```js
ctx.logger.info({ orderId }, 'Processing order');
ctx.logger.error({ err }, 'Something went wrong');
```

---

### `ctx.queue`

Enqueues a background job.

```js
await ctx.queue.enqueue('send-welcome-email', { customerId, email });
```

The queue implementation is a stub in v1; it logs the job and discards it. Real queue integration arrives in a later phase.

---

### `ctx.emit`

The event bus emit function. Plugins can emit custom events that other plugins (or core) can listen to.

```js
await ctx.emit('my-plugin.something-happened', { data });
```

Use a namespaced event name (prefixed with your plugin id) to avoid collisions with platform events.

---

### `ctx.t`

An i18n translation function. Accepts a translation key and returns the localized string. In v1, this is a pass-through stub that returns the key unchanged; real i18n integration arrives later.

```js
const label = ctx.t('myPlugin.admin.title');
```

Translation keys are contributed via your plugin's `i18n/en.json` file (see [Plugin Folder Layout](#plugin-folder-layout)).

---

## Event Hook Catalog

These are the platform events that plugins can listen to. Declare handlers in your manifest's `hooks` field using `defineHooks()`.

| Event                 | Payload fields                                                   | Description                                     |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `order.created`       | `orderId`, `orderNumber`, `totalCents`, `currency`, `customerId` | Fired when a new order is placed and persisted. |
| `order.updated`       | `orderId`, `status`                                              | Fired when an order's status changes.           |
| `payment.refunded`    | `orderId`, `refundId`, `amountCents`, `currency`                 | Fired when a payment refund is completed.       |
| `customer.registered` | `customerId`, `email`                                            | Fired when a new customer account is created.   |
| `cart.abandoned`      | `cartId`, `customerId`, `currency`                               | Fired when a cart is detected as abandoned.     |

Hook handlers are plain async functions. They receive the payload as their only argument:

```js
hooks: defineHooks({
  'order.created': async ({ orderId, orderNumber, totalCents, currency, customerId }) => {
    // handle the event
  },
  'customer.registered': async ({ customerId, email }) => {
    // handle the event
  },
}),
```

Handlers are invoked by the event bus when the corresponding event fires. If a handler throws, the error is contained by the event bus and does not affect other handlers or the caller.

**Note:** Hook handlers do not receive `ctx`. If a handler needs database access or other services, import them directly at the top of your `index.server.js` file.

---

## Plugin Data Storage

Plugins have access to a namespaced key-value store backed by the `PluginData` database table.

The table schema has a composite unique constraint on `(pluginId, key)`. This means two different plugins can use the same key name without conflict, and reads/writes for one plugin can never touch another plugin's data.

Values are stored as JSON strings. `ctx.plugin.set()` serializes with `JSON.stringify` before writing, and `ctx.plugin.get()` parses with `JSON.parse` on read. If parsing fails (for example if the stored value is a raw string), `get()` returns the raw string value.

```js
// Store a structured object
await ctx.plugin.set('config', { apiKey: 'abc123', endpoint: 'https://...' });

// Read it back — returns the parsed object
const config = await ctx.plugin.get('config');

// Append to a list (common pattern for event log plugins)
const existing = (await ctx.plugin.get('events')) ?? [];
const updated = [newEvent, ...existing].slice(0, 100);
await ctx.plugin.set('events', updated);

// Remove a key
await ctx.plugin.delete('config');
```

In v1, `PluginData` is the only storage mechanism plugins have. Plugins cannot define custom Prisma models. If you need relational storage or more complex queries, you must serialize your data structures into the `value` column.

---

## Admin Routes

A plugin that sets `adminRoutes` in its manifest gets a dedicated admin page mounted at `/admin/plugins/<pluginId>/*`.

The value of `adminRoutes` is a path relative to the plugin's root directory pointing to a routes file. This file must export a `routes` array. Each route entry follows React Router conventions and must have the shape:

```js
{
  path: '',              // string — path relative to /admin/plugins/<pluginId>/
  loader: async () => { /* return data */ },  // optional
  Component: MyComponent,                     // required — React component
}
```

Example routes file (`admin/routes.js`):

```js
import prisma from '#/libs/prisma.server';

export const routes = [
  {
    path: '',
    async loader() {
      const data = await prisma.pluginData.findUnique({
        /* ... */
      });
      return { items: data ? JSON.parse(data.value) : [] };
    },
    Component: MyAdminPage,
  },
];

function MyAdminPage({ loaderData }) {
  const { items } = loaderData ?? { items: [] };
  return <div>{/* render items */}</div>;
}
```

The `loader` function runs on the server before the component renders, matching standard React Router loader behavior. Components receive loader data via the `loaderData` prop.

Full admin route resolution (`resolvePluginRoute`) is implemented in Phase 5.

---

## Plugin Blocks for Storefront Slots

Plugins can inject UI components into named slots in the storefront theme. Each slot is a well-known insertion point that the active theme renders at a specific location on the page.

### Available Slots

| Slot name                  | Location                                       |
| -------------------------- | ---------------------------------------------- |
| `home.hero`                | Home page — inside the hero section            |
| `home.featured`            | Home page — featured products area             |
| `product.afterDescription` | Product page — below the product description   |
| `product.sidebar`          | Product page — sidebar area                    |
| `category.top`             | Category listing page — above the product grid |
| `cart.summary`             | Cart page — order summary area                 |
| `checkout.afterPayment`    | Checkout flow — below the payment form         |
| `account.dashboard`        | Customer account dashboard                     |
| `layout.header`            | Global layout — inside the header              |
| `layout.footer`            | Global layout — inside the footer              |

### Contributing a Block

Create a `.jsx` file in your plugin's `blocks/` directory. The filename (without the `.jsx` extension) must exactly match the slot name, with dots preserved:

```
app/plugins/my-plugin/blocks/product.afterDescription.jsx
```

The file must have a default export that is a React component. The component receives slot-specific props (for example `product` on product page slots):

```jsx
export default function ProductAfterDescriptionBlock({ product }) {
  if (!product) return null;
  return <div>{/* rendered below the product description */}</div>;
}
```

The theme renders slot blocks via `getSlotBlocks(slotName)` from `app/core/themes/index.server.js`. Full slot block resolution is wired in Phase 5.

---

## Sample Plugin Walkthrough

The `sample-analytics` plugin is the canonical reference implementation. It captures `order.created` events and surfaces them in a simple admin table.

**What it does:**

- Listens to `order.created` and appends a structured event record to `PluginData` under the key `recentEvents`, capped at 100 entries.
- Exposes an admin page at `/admin/plugins/sample-analytics/` that reads and displays those events.
- Contributes a UI block to the `product.afterDescription` slot.

### Step 1 — The manifest

`app/plugins/sample-analytics/manifest.js` declares the static metadata. Keeping the manifest in a separate file lets it be imported without pulling in any hook handler code:

```js
export default {
  id: 'sample-analytics',
  name: 'Sample Analytics',
  version: '1.0.0',
  description: 'Captures order.created events and surfaces them in the admin.',
  adminRoutes: './admin/routes.js',
};
```

### Step 2 — The entry point

`app/plugins/sample-analytics/index.server.js` imports the manifest, defines the hook handler, and exports the assembled manifest:

```js
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { defineHooks, definePlugin } from '#/core/plugins/index.server';
import manifest from './manifest.js';

const PLUGIN_ID = manifest.id;
const EVENTS_KEY = 'recentEvents';
const MAX_EVENTS = 100;

// Hook handlers import Prisma directly — they do not receive ctx.
async function handleOrderCreated(payload) {
  try {
    const row = await prisma.pluginData.findUnique({
      where: { pluginId_key: { pluginId: PLUGIN_ID, key: EVENTS_KEY } },
    });

    const existing = row ? JSON.parse(row.value) : [];
    const event = {
      type: 'order.created',
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      totalCents: payload.totalCents,
      currency: payload.currency,
      capturedAt: new Date().toISOString(),
    };
    const updated = JSON.stringify([event, ...existing].slice(0, MAX_EVENTS));

    await prisma.pluginData.upsert({
      where: { pluginId_key: { pluginId: PLUGIN_ID, key: EVENTS_KEY } },
      create: { pluginId: PLUGIN_ID, key: EVENTS_KEY, value: updated },
      update: { value: updated },
    });
  } catch (err) {
    logger.error({ err }, 'sample-analytics: failed to capture order.created');
  }
}

export const pluginManifest = definePlugin({
  ...manifest,
  hooks: defineHooks({
    'order.created': handleOrderCreated,
  }),
});

export default pluginManifest;
```

Key points:

- `definePlugin` validates the manifest at module load time. Any missing required field throws immediately.
- `defineHooks` validates that all values are functions.
- Spreading `...manifest` keeps static metadata in one place and avoids duplication.
- The hook handler uses Prisma directly because handlers do not receive `ctx`. Errors are caught and logged rather than re-thrown to avoid crashing the event bus.

### Step 3 — The admin routes

`app/plugins/sample-analytics/admin/routes.js` exports a single route that reads the stored events and renders a table:

```js
import prisma from '#/libs/prisma.server';

const PLUGIN_ID = 'sample-analytics';
const EVENTS_KEY = 'recentEvents';

export const routes = [
  {
    path: '',
    async loader() {
      const row = await prisma.pluginData.findUnique({
        where: { pluginId_key: { pluginId: PLUGIN_ID, key: EVENTS_KEY } },
      });
      const events = row ? JSON.parse(row.value) : [];
      return { events };
    },
    Component: RecentEventsPage,
  },
];
```

The `loader` fetches data server-side; `RecentEventsPage` renders it client-side via `loaderData`.

### Step 4 — The storefront block

`app/plugins/sample-analytics/blocks/product.afterDescription.jsx` contributes a small indicator block to every product page:

```jsx
export default function ProductAfterDescriptionBlock({ product }) {
  if (!product) return null;
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      <span className="font-medium text-slate-700">Analytics</span> — this
      product is being tracked by the Sample Analytics plugin.
    </div>
  );
}
```

### Step 5 — i18n strings

`app/plugins/sample-analytics/i18n/en.json` contributes translation keys merged into the platform's i18n catalog:

```json
{
  "sampleAnalytics.admin.title": "Sample Analytics",
  "sampleAnalytics.admin.noEvents": "No events captured yet. Place an order to see data here."
}
```

Keys should be prefixed with a camelCase version of the plugin id to avoid collisions.

---

## Plugin Folder Layout

```
app/plugins/
  <plugin-id>/
    manifest.js              Static metadata — id, name, version, description, adminRoutes.
    index.server.js          Main entry point. Calls definePlugin() and exports pluginManifest.
    admin/
      routes.js              Exported as { routes: [...] }. Required if adminRoutes is set.
    blocks/
      <slot-name>.jsx        One file per slot. Filename must match the slot name exactly.
    i18n/
      en.json                Translation key/value pairs. Merged into the platform i18n catalog.
```

All files except `manifest.js` and `index.server.js` are optional. Only create the ones your plugin needs.

The `index.server.js` file is the module that gets imported at startup. It must export `pluginManifest` as a named export and as the default export.
