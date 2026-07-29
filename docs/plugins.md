# Plugin System

This document describes the bermooda plugin architecture and serves as the reference for developers building plugins.

---

## Table of Contents

1. [Overview](#overview)
2. [Package.json contract and runtime entry](#packagejson-contract-and-runtime-entry)
3. [API Reference](#api-reference)
4. [The ctx Object](#the-ctx-object)
5. [Event Hook Catalog](#event-hook-catalog)
6. [Plugin Data Storage](#plugin-data-storage)
7. [Admin Routes](#admin-routes)
8. [Storefront Routes](#storefront-routes)
9. [Plugin Blocks for Storefront Slots](#plugin-blocks-for-storefront-slots)
10. [Plugin Blocks for Admin Slots](#plugin-blocks-for-admin-slots)
11. [Building a Plugin (example)](#building-a-plugin-example)
12. [Plugin Folder Layout](#plugin-folder-layout)

---

## Overview

Plugins extend the bermooda platform without modifying core code. Each plugin is a self-contained directory under `app/plugins/<slug>/` where the folder name matches `package.json` `bermooda.slug`. Identity lives in `package.json`; runtime behavior lives in `index.server.js`.

The registered plugin `id` is always the full package name from `package.json` `name` (for example `@bermooda/meilisearch`). URLs use `bermooda.slug` (for example `/admin/plugins/meilisearch/*` and `/apps/meilisearch/*`). The slug must be lowercase hyphenated.

The plugin lifecycle is:

1. **Define runtime** — the plugin calls `definePlugin({ hooks, providers, blocks, ... })` at module load time to validate runtime behavior only.
2. **Discover** — the plugin engine globs `app/plugins/*/index.server.js` and sibling `package.json` files, verifies `app/plugins/<slug>/` matches `bermooda.slug`, and merges package identity with the runtime export.
3. **Register** — `register(manifest)` adds the merged plugin manifest to the in-memory registry by full package id and indexes it by slug for URL dispatch.
4. **Enable** — `enable(pluginId)` wires hook handlers onto the event bus, registers providers from `manifest.providers`, and calls `onEnable(ctx)`. Admin toggles persist the `enabledPlugins` array using full package ids via `setPluginEnabledState()` and call `enable()` immediately.
5. **Disable** — `disable(pluginId)` calls `onDisable(ctx)`, unregisters providers, and removes hook handlers. Admin toggles use `setPluginEnabledState()` to update `enabledPlugins` and call `disable()` immediately.

In the admin plugins screen, toggling a plugin updates the persisted `enabledPlugins` array for startup and also calls `enable()` or `disable()` immediately so hooks, providers, and lifecycle callbacks are wired live without waiting for a restart.

All plugin infrastructure lives in `app/core/plugins/index.server.js`.

---

## Package.json contract and runtime entry

Every plugin has a `package.json` for identity and display metadata:

```json
{
  "name": "@bermooda/my-plugin",
  "version": "1.0.0",
  "description": "Adds a custom integration.",
  "private": true,
  "bermooda": {
    "title": "My Plugin",
    "slug": "my-plugin",
    "engine": ">=1.0.0",
    "settings": [{ "key": "apiKey", "label": "API Key", "type": "password" }]
  }
}
```

### Field Reference

| Runtime field | Source              | Required | Description                                                                  |
| ------------- | ------------------- | -------- | ---------------------------------------------------------------------------- |
| `id`          | `name`              | yes      | Full package name, including scope. This is the registry and persistence id. |
| `version`     | `version`           | yes      | Plugin version. Semver recommended.                                          |
| `description` | `description`       | no       | Short description shown in admin.                                            |
| `title`       | `bermooda.title`    | yes      | Human-readable display title shown in admin.                                 |
| `slug`        | `bermooda.slug`     | yes      | Lowercase hyphenated URL and folder key.                                     |
| `engine`      | `bermooda.engine`   | yes      | Semver range of compatible bermooda app versions (e.g. `>=1.0.0`).           |
| `settings`    | `bermooda.settings` | no       | Package-driven admin settings schema.                                        |

Rules:

- `id` is the full `package.json` `name`, such as `@bermooda/meilisearch`.
- `bermooda.slug` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- URLs use slug, not id: `/admin/plugins/<slug>/*` and `/apps/<slug>/*`.
- Bundled folders use `app/plugins/<slug>/`; the folder name must equal `bermooda.slug`.
- `enabledPlugins` and plugin data namespaces store full package ids.
- `bermooda.engine` is checked against the shop root `package.json` `version`. The bermooda CLI rejects install/update when incompatible; at runtime, discovery logs and soft-skips incompatible plugins instead of failing startup.
- `adminRoutes` and `storefrontRoutes` do not belong in package metadata. Route presence is discovered from `admin/routes` and `storefront/routes` files.

Runtime behavior is declared in `index.server.js`:

```js
import { defineHooks, definePlugin } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  hooks: defineHooks({
    'order.created': handleOrderCreated,
  }),
  providers: {
    // optional provider specs
  },
  blocks: {
    // optional storefront/admin slot components
  },
  onEnable: async (ctx) => {
    // optional startup work
  },
  onDisable: async (ctx) => {
    // optional cleanup work
  },
});

export default pluginManifest;
```

Discovery merges `package.json` identity with this runtime export before registration. `definePlugin()` validates runtime only; it does not accept or validate identity fields.

### Imports

Inside a plugin package (`app/plugins/<slug>/`):

- Import **sibling plugin modules** with **relative** paths (for example `./provider/index.server`, `../data/index.server`, `./package.json`).
- Import **core app modules** with the `#/…` alias (for example `#/core/plugins/index.server`, `#/utils/logger.server`, `#/libs/prisma.server`).
- Outside plugins, the core app and routes continue to load plugins via `#/plugins/<slug>/…`.

Oxlint enforces the sibling-import rule with `no-restricted-imports` on `app/plugins/**`.

---

## API Reference

All functions are exported from `app/core/plugins/index.server.js`. Import with the `#/core/plugins/index.server` alias.

### `definePlugin(runtime)`

Validates plugin runtime configuration and returns it unchanged. Identity comes from sibling `package.json`, so do not pass `id`, `title`, `name`, `version`, or `slug` here.

```js
import { definePlugin } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  providers: {
    // provider specs
  },
});
```

**Throws:** `Error` if runtime is not an object or if `providers` contains invalid provider specs.

---

### `defineHooks(hookMap)`

Validates that every value in the hook map is a function, then returns the map. Use this when declaring the runtime `hooks` field.

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

For `payment`, `shipping`, `tax`, `address_validation`, and `email`, the `spec` object is the provider implementation that will be registered into the matching registry.

```js
providers: {
  my_gateway: defineProvider('payment', {
    name: 'My Gateway',
    createCheckoutSession: async ({ cart, successUrl, cancelUrl }) => {
      /* ... */
    },
    verifyWebhook: async (request) => {
      /* ... */
    },
    handleWebhookEvent: async (event) => {
      /* ... */
    },
    createRefund: async ({ paymentIntentId, amountCents, reason }) => {
      /* ... */
    },
  }),
};
```

Custom email transports implement `send({ from, to, subject, html, text? })`. First-party transports are external plugins (`@bermooda/plugin-resend`, `@bermooda/plugin-sendgrid`, `@bermooda/plugin-aws-ses`) installed under `app/plugins/{resend,sendgrid,aws-ses}/`. Only one email-provider plugin can be active: enabling another under **Admin → Plugins → Email providers** automatically deactivates the previous one.

```js
import { definePlugin, defineProvider } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  providers: {
    postmark: defineProvider('email', {
      name: 'Postmark',
      async send({ from, to, subject, html, text }) {
        // Call your ESP API with the already-rendered HTML.
        return { success: true };
      },
    }),
  },
});
```

The email registry lives in `#/libs/email`. Credentials stay in environment variables.

For `search`, pass the search implementation as `spec.provider`. Set `isDefault: true` if the plugin should become the active default search provider while enabled:

```js
import { definePlugin, defineProvider } from '#/core/plugins/index.server';

import { meilisearchProvider } from './provider/index.server';

export const pluginManifest = definePlugin({
  providers: {
    meilisearch: defineProvider('search', {
      provider: meilisearchProvider,
      isDefault: true,
    }),
  },
});
```

**Parameters:**

- `type` — must be one of `'payment'`, `'shipping'`, `'tax'`, `'search'`, `'address_validation'`, or `'email'`.
- `spec` — object with provider-specific fields.

**Throws:** `Error` if `type` is not one of the valid values, or if `spec` is not an object.

---

### `defineProviders(providerMap)`

Validates a `providers` map and returns it unchanged. Each value must be a provider spec created with `defineProvider()`.

```js
import {
  definePlugin,
  defineProvider,
  defineProviders,
} from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  providers: defineProviders({
    my_gateway: defineProvider('payment', {
      name: 'My Gateway',
      createCheckoutSession: async () => {
        /* ... */
      },
    }),
  }),
});
```

Use this when you want explicit validation of the entire provider map at declaration time. `definePlugin()` also validates the `providers` field when present.

---

### `register(manifest)`

Adds a fully merged manifest to the in-memory plugin registry. Registration validates package identity (`id`, `title`, `version`, `slug`) plus runtime fields and indexes the plugin by both id and slug.

```js
import { register } from '#/core/plugins/index.server';
import { mergeExtensionPackage } from '#/core/extensions/package-meta';
import runtime from '#/plugins/my-plugin/index.server';
import pkg from '#/plugins/my-plugin/package.json';

register(mergeExtensionPackage(pkg, runtime));
```

Calling `register()` does not enable the plugin or wire any handlers. Call `enable()` separately to activate the plugin.

---

### `enable(pluginId)`

Enables a registered plugin in-process. This is an async function that:

1. Registers all hook handlers from `manifest.hooks` onto the event bus via `on(event, handler)`.
2. Registers all providers from `manifest.providers` into the matching core provider registries.
3. Calls `manifest.onEnable(ctx)` if defined.

```js
import { enable } from '#/core/plugins/index.server';

await enable('@bermooda/my-plugin');
```

**Throws:** `Error` if the plugin is not in the registry.

If the plugin is already enabled, `enable()` returns immediately without re-registering hooks/providers or calling `onEnable` again.

Admin UI toggles should call `setPluginEnabledState(pluginId, true)` with the full package id instead of `enable()` directly so the `enabledPlugins` setting stays in sync.

---

### `disable(pluginId)`

Disables a registered plugin in-process. This is an async function that:

1. Calls `manifest.onDisable(ctx)` if defined.
2. Unregisters all providers previously registered from `manifest.providers`. Search providers that temporarily became the default restore the previous default provider automatically.
3. Removes all hook handlers from the event bus via `off(event, handler)` and clears the handlers map.

```js
import { disable } from '#/core/plugins/index.server';

await disable('@bermooda/my-plugin');
```

**Throws:** `Error` if the plugin is not in the registry.

Admin UI toggles should call `setPluginEnabledState(pluginId, false)` with the full package id instead of `disable()` directly so the `enabledPlugins` setting stays in sync.

---

### `setPluginEnabledState(pluginId, enabled)`

Persists the plugin in the `enabledPlugins` setting array and wires or unwires the plugin live by calling `enable()` or `disable()`. Rolls back the setting if live wiring fails.

```js
import { setPluginEnabledState } from '#/core/plugins/index.server';

await setPluginEnabledState('@bermooda/my-plugin', true);
await setPluginEnabledState('@bermooda/my-plugin', false);
```

---

### `listRegisteredPlugins()`

Returns all registered plugin manifests from the in-memory registry.

```js
import { listRegisteredPlugins } from '#/core/plugins/index.server';

const plugins = listRegisteredPlugins();
```

---

### `getRegisteredPlugin(pluginId)`

Returns a registered plugin manifest by id, or `null`.

---

### `getEnabledPluginIds()` / `isPluginEnabled(pluginId)`

Read helpers for the persisted `enabledPlugins` setting array. The setting stores full package ids, such as `@bermooda/meilisearch`; legacy short ids are normalized on read.

---

### `loadPluginSettings(manifest)` / `savePluginSettings(pluginId, manifest, formData)`

Load and persist package-driven plugin settings stored under `plugin.<pluginId>.<key>`, where `pluginId` is the full package id.

Setting field types: `text`, `select`, `toggle`, and `password`. Password values are encrypted at rest with AES-256-GCM (key derived from `BETTER_AUTH_SECRET`) and redacted when loaded for admin/API display. Leaving a password field blank on save keeps the existing value. Providers should read secrets with `getPluginSettingSecret(pluginId, key)` from `#/core/plugins/settings.server`.

---

### `setPluginOrder(orderedIds)`

Persist the full plugin display order. `orderedIds` must be a permutation of all registered plugin ids.

---

### `resolvePluginAdminRoute(pluginId, path)`

Resolves an admin route descriptor for a plugin folder slug using the splat path relative to `/admin/plugins/<slug>/`.

### `resolvePluginStorefrontRoute(pluginId, path)`

Resolves a storefront route descriptor for a plugin folder slug using the splat path relative to `/apps/<slug>/`.

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

An i18n translation function backed by the default-locale message catalog. Accepts a translation key and optional interpolation params.

```js
const label = ctx.t('myPlugin.admin.title');
const greeting = ctx.t('myPlugin.welcome', { name: 'Ada' });
```

Translation keys are contributed via your plugin's `i18n/en.json` file (see [Plugin Folder Layout](#plugin-folder-layout)).

---

## Event Hook Catalog

These are the core platform events that bermooda emits today. Declare handlers in the runtime `hooks` field using `defineHooks()`.

### Post-action hooks

These events fire after the underlying domain work has happened. Post-hooks are **fire-and-forget**: `emit()` returns immediately and handlers run in parallel in the background. They are fault-tolerant: if a handler throws, the event bus logs the error and the remaining handlers still run. Post-hooks do not receive `ctx`; they receive only the payload.

#### Orders and checkout

| Event                | Payload fields                                                                                                                                                          | Description                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `checkout.started`   | `sessionId`, `cartId`, `customerId`, `email`                                                                                                                            | Fired after a checkout session is created and the cart is locked.                 |
| `checkout.completed` | `orderId`, `orderNumber`, `checkoutSessionId`, `customerId`, `email`, `status`, `subtotalCents`, `shippingCents`, `taxCents`, `discountCents`, `totalCents`, `currency` | Fired after `placeOrder()` succeeds and the checkout session is marked completed. |
| `order.created`      | `orderId`, `orderNumber`, `checkoutSessionId`, `customerId`, `email`, `status`, `subtotalCents`, `shippingCents`, `taxCents`, `discountCents`, `totalCents`, `currency` | Fired after an order is placed successfully.                                      |
| `order.confirmed`    | `orderId`, `orderNumber`                                                                                                                                                | Fired when a successful payment webhook confirms an order.                        |
| `order.updated`      | `orderId`, `previousStatus`, `status`                                                                                                                                   | Fired when `updateOrderStatus()` changes an order status value.                   |
| `order.fulfilled`    | `orderId`, `status`                                                                                                                                                     | Fired when fulfillment sync transitions an order to `fulfilled`.                  |
| `order.cancelled`    | `orderId`, `orderNumber`                                                                                                                                                | Fired after an order is cancelled.                                                |
| `order.returned`     | `returnId`, `orderId`                                                                                                                                                   | Fired after a return is received and the order is marked as returned.             |

#### Cart, customer, and catalog

| Event                 | Payload fields                                                   | Description                                                                                                       |
| --------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `cart.created`        | `cartId`, `token`, `currency`, `customerId`, `expiresAt`         | Fired after a new cart is created.                                                                                |
| `cart.itemAdded`      | `cartId`, `variantId`, `quantity`, `lineId`                      | Fired after a line is created or incremented in a cart.                                                           |
| `cart.itemRemoved`    | `cartId`, `lineId`                                               | Fired after a cart line is removed.                                                                               |
| `cart.updated`        | `cartId`, `lineId`, `quantity`                                   | Fired after a cart line quantity is updated to a positive value.                                                  |
| `cart.abandoned`      | `cartId`, `token`, `email`, `currency`, `lineCount`, `updatedAt` | Fired when the abandoned-cart job decides a reminder sequence should run. `updatedAt` is an ISO timestamp string. |
| `customer.registered` | `customerId`, `email`, `name`                                    | Fired after Better Auth creates a new customer account row.                                                       |
| `product.created`     | `productId`                                                      | Fired after a product record is created.                                                                          |
| `product.updated`     | `productId`                                                      | Fired after a product record is updated.                                                                          |
| `product.deleted`     | `productId`                                                      | Fired after a product record is deleted.                                                                          |

#### Fulfillment, payments, returns, and inventory

| Event                 | Payload fields                                                      | Description                                                                                                               |
| --------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `shipment.created`    | `shipmentId`, `orderId`                                             | Fired after a shipment record is created.                                                                                 |
| `shipment.shipped`    | `shipmentId`, `orderId`, `carrier`, `trackingNumber`, `trackingUrl` | Fired after a shipment is marked shipped.                                                                                 |
| `shipment.delivered`  | `shipmentId`, `orderId`                                             | Fired after a shipment is marked delivered.                                                                               |
| `payment.succeeded`   | `type`, `orderId`, `amount`                                         | Normalized payment-provider webhook event for a successful payment. `amount` is provider-normalized cents when available. |
| `payment.failed`      | `type`, `orderId`                                                   | Normalized payment-provider webhook event for a failed or expired payment.                                                |
| `payment.other`       | `type`                                                              | Plugin-facing catch-all for unhandled payment-provider webhook event types.                                               |
| `payment.refunded`    | `refundId`, `orderId`, `amountCents`                                | Fired after a refund record is created.                                                                                   |
| `return.requested`    | `returnId`, `orderId`, `customerId`                                 | Fired after a return request is created.                                                                                  |
| `return.approved`     | `returnId`, `orderId`, `resolution`                                 | Fired after a return request is approved.                                                                                 |
| `return.received`     | `returnId`, `orderId`                                               | Fired after returned inventory is received.                                                                               |
| `return.completed`    | `returnId`, `orderId`, `resolution`, `amountCents`                  | Fired after a return is completed as refund, store credit, or exchange.                                                   |
| `return.cancelled`    | `returnId`, `orderId`                                               | Fired after a return request is cancelled.                                                                                |
| `inventory.restocked` | `variantId`                                                         | Fired when inventory for a variant goes from out-of-stock to in-stock.                                                    |

Events intentionally not emitted today:

- `customer.loggedIn` — skipped for now to avoid a noisy auth event surface.
- `product.viewed` — skipped for now; page-view analytics should use a separate analytics/event stream instead of the domain event bus.

Hook handlers are plain async functions. They receive the payload as their only argument:

```js
hooks: defineHooks({
  'order.updated': async ({ orderId, previousStatus, status }) => {
    // handle the event
  },
  'customer.registered': async ({ customerId, email, name }) => {
    // handle the event
  },
}),
```

Handlers are invoked by the event bus when the corresponding event fires. Completion order is not guaranteed. If a post-hook handler throws, the error is contained by the event bus and does not affect other handlers or the caller.

### Before-hooks (blocking filters)

Before-hooks let a plugin **veto** a domain action before any database write occurs. Register them in the runtime `hooks` field using keys that start with `before.`:

```js
import { defineHooks, definePlugin, deny } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  hooks: defineHooks({
    'before.shipment.ship': async ({ orderId, order }) => {
      if (order.status === 'on_hold') {
        deny('Order is on hold and cannot be shipped.', { code: 'FRAUD_HOLD' });
      }
    },
    'order.created': async (payload) => {
      // post-hook — unchanged
    },
  }),
});
```

**Contract:**

| Aspect      | Behavior                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Allow       | Return normally (return value ignored in MVP).                                                                                               |
| Block       | Call `deny(reason, { code })` — or throw any error (fail-closed).                                                                            |
| Dispatch    | Handlers run **in parallel**; `emitBefore` still **awaits all** before returning. Every handler runs even if another fails.                  |
| Errors      | Fail-closed: if any handler throws, the action aborts. Prefers the first-registered `HookAbortError`, else the first-registered plain error. |
| Performance | Filters run on the request critical path before the transaction — keep them fast and avoid mutating the shared payload.                      |

Import `deny`, `emitBefore`, `HookAbortError`, and `isHookAbort` from `#/core/plugins/index.server` (re-exported from the event bus).

When a plugin vetoes an action, core surfaces `HookAbortError.reason` to merchants. Admin API routes return `422` with `{ error, code, blockedBy }`. A veto is a business decision, not an operational error — it is not sent through `handleError` / `sendErrorAlert`.

#### Before-hook catalog

| Event                     | Payload                                              | Blocks                              |
| ------------------------- | ---------------------------------------------------- | ----------------------------------- |
| `before.shipment.create`  | `{ orderId, order, data }`                           | Creating a shipment record          |
| `before.shipment.ship`    | `{ shipmentId, orderId, shipment, order, data }`     | Marking a shipment shipped          |
| `before.shipment.deliver` | `{ shipmentId, orderId, shipment }`                  | Marking a shipment delivered        |
| `before.order.place`      | `{ checkoutSessionId, session, cart, totals }`       | Order creation at checkout          |
| `before.order.cancel`     | `{ orderId, order }`                                 | Cancelling an order                 |
| `before.refund.create`    | `{ orderId, order, amountCents, reason }`            | Issuing a refund                    |
| `before.checkout.advance` | `{ sessionId, session, fromStep, toStep, stepData }` | Advancing to the next checkout step |

Reserved error codes (plugins may define their own): `HOOK_BLOCKED` (default), `FRAUD_HOLD`, `INVENTORY_HOLD`, `REFUND_POLICY`, `ADDRESS_INVALID`, `COMPLIANCE_HOLD`.

See [`docs/before-hooks-plan.md`](./before-hooks-plan.md) for design rationale. Plugins can call `deny()` from a `before.*` hook to block the action (for example holding fulfillment until review).

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

A plugin that includes `admin/routes/index.server.js` and `admin/routes.client.js` gets a dedicated admin page mounted at `/admin/plugins/<slug>/*`. The `<slug>` segment is `bermooda.slug`, not the full package id.

Admin routes are defined as a server/client pair:

- `admin/routes/index.server.js` — exports route descriptors with optional `loader`
- `admin/routes.client.js` — exports route descriptors with the client `Component`

Both files must export the same `routes` array shape. Each route entry follows React Router conventions and must have the shape:

```js
{
  path: '',              // string — path relative to /admin/plugins/<slug>/
  loader: async () => { /* return data */ },  // optional
  Component: MyComponent,                     // required — React component
}
```

Example server routes file (`admin/routes/index.server.js`):

```js
import prisma from '#/libs/prisma.server';

export const routes = [
  {
    path: '',
    async loader() {
      const data = await prisma.pluginData.findUnique({/* ... */});
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

The dispatcher resolves admin pages with `resolvePluginAdminRoute(pluginSlug, params['*'])`. Route presence is glob-driven; do not add `adminRoutes` to package metadata.

---

## Storefront Routes

A plugin that includes `storefront/routes/index.server.js` and `storefront/routes.client.js` gets a dedicated storefront page mounted at `/apps/<slug>/*`. The `<slug>` segment is `bermooda.slug`.

Storefront routes follow the same split-module pattern as admin routes:

- `storefront/routes/index.server.js` — exports route descriptors with optional `loader`
- `storefront/routes.client.js` — exports route descriptors with the client `Component`

Each route entry has the same shape:

```js
{
  path: '',              // string — path relative to /apps/<slug>/
  loader: async () => { /* return data */ },  // optional
  Component: MyComponent,                     // required
}
```

The storefront dispatcher:

- uses `params['*']` as the splat path
- only exposes storefront routes for enabled plugins
- resolves the server descriptor with `resolvePluginStorefrontRoute(pluginSlug, params['*'])`
- runs the descriptor `loader` on the server when present
- resolves the client component from `storefront/routes.client.js`

Example client routes file (`storefront/routes.client.js`):

```js
import { AnalyticsPage } from './analytics-page';

export const routes = [{ path: '', Component: AnalyticsPage }];
```

Example URL:

```txt
/apps/my-plugin/
```

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

Create a `.jsx` file under your plugin's `blocks/` directory using lowercase, hyphenated paths. Mirror each dotted segment of the slot name as its own directory segment, then use a hyphenated leaf file (for example slot `product.afterDescription` → `blocks/product/after-description.jsx`):

```
app/plugins/my-plugin/blocks/product/after-description.jsx
```

The file must have a default export that is a React component. The component receives slot-specific props (for example `product` on product page slots):

```jsx
export default function ProductAfterDescriptionBlock({ product }) {
  if (!product) return null;
  return <div>{/* rendered below the product description */}</div>;
}
```

The theme renders slot blocks via `getSlotBlocks(slotName)` from `app/core/themes/index.server.js`.

---

## Plugin Blocks for Admin Slots

Plugins can inject UI components into named slots in admin views. Each slot is a well-known insertion point that core admin routes render at a specific location on the page.

Admin and storefront slots share the same manifest `blocks` map — use distinct slot names for each surface.

### Available Slots

| Slot name           | Location                                     |
| ------------------- | -------------------------------------------- |
| `dashboard.widgets` | Admin dashboard — below KPI tiles            |
| `order.detail`      | Order detail page — below the page header    |
| `customer.detail`   | Customer detail page — below the page header |
| `product.editor`    | Product editor — below the page header       |

The canonical list lives in `ADMIN_SLOT_NAMES` in `app/core/admin/slots/index.server.js`.

### Contributing a Block

Use the same `blocks/` file naming convention as storefront slots. For example, slot `dashboard.widgets` → `blocks/dashboard/widgets.jsx`:

```
app/plugins/my-plugin/blocks/dashboard/widgets.jsx
```

Register the component in your plugin's `index.server.js`:

```js
import DashboardWidgetsBlock from './blocks/dashboard/widgets';

export const pluginManifest = definePlugin({
  blocks: {
    'dashboard.widgets': DashboardWidgetsBlock,
  },
});
```

Admin route loaders resolve blocks server-side with `getAdminSlotBlocksMap()` from `app/core/admin/slots/index.server.js` and pass them to the shared `SlotBlocks` component in `app/components/slot-blocks/index.jsx`.

### Slot props

Each admin page passes context to plugin blocks via `slotProps`:

| Admin page      | `slotProps`                                                                           |
| --------------- | ------------------------------------------------------------------------------------- |
| Dashboard       | `{ totalOrders, totalRevenueCents, abandonedCheckouts, lowStockCount, recentOrders }` |
| Order detail    | `{ order }`                                                                           |
| Customer detail | `{ customer }`                                                                        |
| Product editor  | `{ product, mode }` (`mode` is `'create'` or `'edit'`)                                |

Blocks only render when the plugin is enabled. Render order follows the `pluginOrder` setting (same as storefront slots).

---

## Building a Plugin (example)

First-party plugins install under `app/plugins/<slug>/` (for example `meilisearch`, `resend`, `sendgrid`, `aws-ses`). Third-party plugins follow the same layout.

Minimal plugin:

```
app/plugins/my-plugin/
  package.json
  index.server.js
```

`package.json` identity:

```json
{
  "name": "@acme/my-plugin",
  "version": "0.1.0",
  "description": "Example plugin",
  "private": true,
  "bermooda": {
    "title": "My Plugin",
    "slug": "my-plugin",
    "engine": ">=0.1.0"
  }
}
```

`index.server.js` runtime:

```js
import { defineHooks, definePlugin } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  hooks: defineHooks({
    'order.created': async (payload) => {
      // Handle the event. Import Prisma or helpers directly — no ctx.
    },
  }),
});

export default pluginManifest;
```

Optional folders (`admin/`, `storefront/`, `blocks/`, `i18n/`) follow the layout below. Discovery merges `package.json` identity with the `definePlugin()` runtime export; the folder name must equal `bermooda.slug`.

Translation keys should be prefixed with a camelCase version of the plugin slug to avoid collisions.

---

## Plugin Folder Layout

```
app/plugins/
  <slug>/
    package.json             Identity — name/id, version, description, bermooda.title, bermooda.slug, settings.
    index.server.js          Runtime entry. Calls definePlugin() and exports pluginManifest.
    admin/
      routes/
        index.server.js      Server route descriptors with optional loaders.
        index.test.server.js Colocated server route tests (optional).
      routes.client.js       Client route descriptors with Components.
    storefront/
      routes/
        index.server.js      Server route descriptors with optional loaders.
        index.test.server.js Colocated server route tests (optional).
      routes.client.js       Client route descriptors with Components.
    blocks/
      <slot-name>.jsx        One file per slot. Filename must match the slot name exactly.
    i18n/
      en.json                Translation key/value pairs. Merged into the platform i18n catalog.
```

All files except `package.json` and `index.server.js` are optional. Only create the ones your plugin needs.

The `index.server.js` file is the runtime module imported at startup. It must export `pluginManifest` as a named export and as the default export. The plugin folder name must equal `bermooda.slug`; route modules are discovered from folders, not from `adminRoutes` or `storefrontRoutes` metadata.
