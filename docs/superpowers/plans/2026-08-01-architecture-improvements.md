# Architecture Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the `libs → core` dependency boundary, finish sales-channel plumbing on the purchase path, split checkout/orders/plugins mega-modules, durable domain events via a LiteQuu job (email-job pattern), complete plugin dispatchers, and align platform docs/contracts with reality.

**Architecture:** Keep the existing three-layer model (`routes → core → libs`) but make it enforceable. Hard-cut move pure config into `libs` (no `#/core/config` compatibility shim — app is pre-production). Relocate domain-aware helpers out of `libs`. Inject domain callbacks into auth at bootstrap. Persist post-commit `emit()` through a `domain_event` queue job while leaving `emitBefore` synchronous. Split oversized core modules along existing concern seams. Thread `salesChannelId` cart → checkout → order. Extend plugin dispatchers with `action` + richer path matching. Document single-shop / dual-DB / plugin `ctx` honestly.

**Tech Stack:** React Router 7, Prisma 7, LiteQuu (`#/libs/queue.server` + `defineQueueJob`), Vitest, oxlint `no-restricted-imports`, JSDoc/`checkJs`.

**Sources:** Architecture review (run “Architectural improvements”); libs/core fix recommendation; items 1–6 from that review.

## Global Constraints

- Conventional Commits on every commit (`refactor:`, `fix:`, `feat:`, `docs:`, `test:`, `chore:` as appropriate).
- JS/JSX in `app/` (no TypeScript). JSDoc on every new/changed export.
- Imports use `#/*` (except relative siblings inside themes/plugins).
- `core → libs` allowed; `libs → core` forbidden after Phase A (enforced by oxlint).
- `emitBefore` stays request-path synchronous and fail-closed; only post-hooks go through the queue.
- Do not bump `package.json` version; do not invent multi-tenant SaaS schema.
- Each task ends with targeted tests green; before PR: `npm run lint`, `npm run build`, and relevant `npm run test`.
- Prefer small PRs per phase (A→F) if landing incrementally; this plan is one roadmap.

## File map

| Path                                                                                 | Responsibility                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `app/libs/config/index.js`                                                           | Moved runtime config (`createConfig`, `PLATFORM_NAME`, `DEFAULT_AUTH`)      |
| `app/libs/config/port.js`                                                            | Moved `resolveDevPort` / `DEFAULT_DEV_PORT`                                 |
| `app/core/config/*`                                                                  | Deleted in the same change (no re-export shim)                              |
| `app/libs/auth/customer/index.server.js`                                             | `setOnCustomerRegistered` injection; no `#/core/events` import              |
| `app/core/bootstrap/index.server.js`                                                 | Wire customer-registered emit + import events job                           |
| `app/core/api-keys/middleware.server.js`                                             | Moved admin API-key middleware from `libs/auth/api`                         |
| `app/core/api-keys/audit.server.js`                                                  | Moved API-key audit helper (or keep calling `#/core/audit` from middleware) |
| `app/core/storefront/page-context.server.js`                                         | `loadStorefrontPageContext`, `parseReturnTo` (from `libs/api/storefront`)   |
| `app/libs/api/{public,admin,admin-ui,webhooks}`                                      | Pure HTTP helpers only (no core imports)                                    |
| `.oxlintrc.json`                                                                     | Restrict `#/core/**` imports from `app/libs/**`                             |
| `app/core/events/index.server.js`                                                    | `setEventJobEnqueuer`, sync `dispatchHandlers`, queued `emit`               |
| `app/core/events/job.server.js`                                                      | LiteQuu `domain_event` job + `queueDomainEvent`                             |
| `app/core/cart/index.server.js`                                                      | Persist `salesChannelId` on create                                          |
| `app/core/checkout/pipeline.server.js`                                               | Copy channel from cart onto checkout session                                |
| Storefront cart/checkout + public cart API routes                                    | Pass channel from request                                                   |
| `app/core/orders/{place,fulfillment,refunds,admin,payment-handlers,index}.server.js` | Split orders mega-module                                                    |
| `app/core/plugins/{registry,lifecycle,providers,blocks,ctx,index}.server.js`         | Split plugins mega-module + provider table                                  |
| `app/core/plugins/routes/index.js`                                                   | Param/splat-aware matching                                                  |
| `app/routes/{storefront/apps,admin/plugins}/$pluginId.jsx`                           | Export `action`; call plugin `action`                                       |
| `docs/{plugins,before-hooks-plan,postgres,oss-competitor-roadmap_*}.md`              | Doc honesty pass                                                            |
| `.cursor/rules/libs-core.mdc` / `CLAUDE.md`                                          | Document config location + event queue                                      |

---

## Phase A — Libs/core boundary (item 1)

### Task 1: Move config to `app/libs/config` (hard cut)

**Files:**

- Create: `app/libs/config/port.js` (move from `app/core/config/port.js`)
- Create: `app/libs/config/index.js` (move from `app/core/config/index.js`)
- Create: `app/libs/config/index.test.js` (move/adapt from `app/core/config/index.test.js`)
- Modify: every file importing `#/core/config` (~33 under `app/`) → `#/libs/config`
- Modify: `app/core/index.js` if it re-exports config — drop those exports
- Delete: `app/core/config/` entirely in the same change (no compatibility re-export)

**Interfaces:**

- Produces: `#/libs/config` default export `config`, named `PLATFORM_NAME`, `DEFAULT_AUTH`, `createConfig`, `resolveBaseUrl`, `resolveDevPort`, `DEFAULT_DEV_PORT`
- Removes: `#/core/config` (callers must use `#/libs/config`)

App is pre-production with no external consumers — do **not** leave a thin `#/core/config` re-export.

- [ ] **Step 1: Move files and fix internal imports**

`app/libs/config/index.js` must import:

```js
import rootConfig from '#bermooda.config';
import { resolveDevPort } from '#/libs/config/port';
export { DEFAULT_DEV_PORT, resolveDevPort } from '#/libs/config/port';
```

Leave behavior identical to today’s `app/core/config/index.js`.

- [ ] **Step 2: Point all callers at `#/libs/config` and delete `app/core/config/`**

```bash
rg -l "from '#/core/config" app --glob '*.{js,jsx}'
# replace with from '#/libs/config'
```

Also update `from "#/core/config/port"` if any. Then delete `app/core/config/`. Confirm zero matches for `#/core/config`.

- [ ] **Step 3: Validate**

Run: `npm run test -- app/libs/config app/libs/auth`
Run: `npx -p typescript tsc --noEmit --allowJs --checkJs --strict --module preserve --moduleResolution bundler --target es2020 --jsx react-jsx "app/libs/config/index.js"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(config): move runtime config from core to libs"
```

### Task 2: Inject `customer.registered` from bootstrap

**Files:**

- Modify: `app/libs/auth/customer/index.server.js`
- Modify: `app/core/bootstrap/index.server.js`
- Modify: `app/libs/auth/customer/index.test.server.js`
- Test: `app/libs/auth/customer/index.test.server.js`

**Interfaces:**

- Produces: `setOnCustomerRegistered(fn | null)` in customer auth
- Consumes: `emit` only from bootstrap (core), not from libs

- [ ] **Step 1: Write failing test for injection**

In `app/libs/auth/customer/index.test.server.js`, assert the module does **not** import `#/core/events`, and that calling the registered callback runs the injected fn:

```js
import { setOnCustomerRegistered } from '#/libs/auth/customer/index.server';

it('invokes injected onCustomerRegistered after user create hook path', async () => {
  const fn = vi.fn();
  setOnCustomerRegistered(fn);
  // exercise the same after(user) path the better-auth hook uses —
  // if the hook is not directly exported, unit-test setOnCustomerRegistered
  // by exporting __runCustomerRegisteredForTests or invoking via documented helper
  await fn.mock.calls; // replace with actual trigger used in implementation
});
```

Prefer exporting a tiny internal helper used by the hook:

```js
/** @type {null | ((payload: { customerId: string, email: string, name?: string | null }) => void | Promise<void>)} */
let onCustomerRegistered = null;

/**
 * Wire domain side effects after customer registration (bootstrap).
 * @param {typeof onCustomerRegistered} fn
 */
export function setOnCustomerRegistered(fn) {
  onCustomerRegistered = fn;
}

/**
 * @param {{ id: string, email: string, name?: string | null }} user
 */
export async function notifyCustomerRegistered(user) {
  if (!onCustomerRegistered) return;
  await onCustomerRegistered({
    customerId: user.id,
    email: user.email,
    name: user.name,
  });
}
```

Hook body:

```js
user create: {
        async after(user) {
          await notifyCustomerRegistered(user);
        },
      },
```

Remove `import { emit } from '#/core/events/index.server'`.

- [ ] **Step 2: Wire bootstrap**

In `registerBuiltins()` (or immediately after imports that load email subscribers):

```js
import { setOnCustomerRegistered } from '#/libs/auth/customer/index.server';
import { emit } from '#/core/events/index.server';

setOnCustomerRegistered((payload) => {
  emit('customer.registered', payload);
});
```

Reset in bootstrap test teardown if needed.

- [ ] **Step 3: Run tests**

Run: `npm run test -- app/libs/auth/customer app/core/bootstrap`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/libs/auth/customer app/core/bootstrap
git commit -m "refactor(auth): inject customer.registered emit from bootstrap"
```

### Task 3: Move API-key middleware into core

**Files:**

- Create: `app/core/api-keys/middleware.server.js` (content from `app/libs/auth/api/index.server.js`)
- Move audit helper with it or import `#/core/audit` from the new middleware file
- Modify: `app/routes/api/admin/v1/_layout.jsx` and any other importers of `#/libs/auth/api`
- Delete or thin: `app/libs/auth/api/*` (leave nothing that imports core)
- Test: move/adapt `app/libs/auth/api/index.test.server.js` → `app/core/api-keys/middleware.test.server.js`

**Interfaces:**

- Produces: `adminApiKeyContext`, `adminApiKeyMiddleware`, `requireAdminApiScope`, `requireApiKey` from `#/core/api-keys/middleware.server`

- [ ] **Step 1: Move module + update imports**

```js
// app/core/api-keys/middleware.server.js
import { createContext } from 'react-router';
import {
  apiKeyCanAccessAdminApi,
  apiKeySatisfiesScope,
  validateApiKey,
} from '#/core/api-keys/index.server';
// ... same middleware bodies as today
```

Update routes:

```js
import {
  adminApiKeyMiddleware,
  requireAdminApiScope,
} from '#/core/api-keys/middleware.server';
```

- [ ] **Step 2: Remove `app/libs/auth/api` core-coupled files**

If nothing remains, delete the directory. Do not leave a re-export shim that pulls core into libs.

- [ ] **Step 3: Tests + commit**

Run: `npm run test -- app/core/api-keys app/routes/api/admin`

```bash
git commit -m "refactor(api-keys): move admin API key middleware into core"
```

### Task 4: Move storefront page context into core; purify `libs/api`

**Files:**

- Create: `app/core/storefront/page-context.server.js`
- Modify: storefront routes that import `#/libs/api/storefront`
- Modify: `app/libs/api/admin/index.server.js` — remove `isHookAbort` import; move hook-abort→JSON mapping next to callers in core or into a small `#/core/events/http.server.js`
- Verify: `app/libs/api/public`, `admin-ui`, `webhooks` have zero `#/core` imports
- Test: move storefront helper tests under `app/core/storefront/`

**Interfaces:**

- Produces: `loadStorefrontPageContext(request)`, `parseReturnTo(formData, fallback?)`
- Produces (if extracted): `jsonFromHookAbort(err)` in `#/core/events/http.server.js`

- [ ] **Step 1: Create page-context helper**

```js
// app/core/storefront/page-context.server.js
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';

/**
 * @param {Request} request
 * @returns {Promise<{ themeId: string, locale: string, currency: string }>}
 */
export async function loadStorefrontPageContext(request) {
  const [themeId, locale, currency] = await Promise.all([
    preloadStorefrontTheme(),
    getRequestLocale(request),
    getRequestCurrency(request),
  ]);
  return { themeId, locale, currency };
}

/**
 * @param {FormData} formData
 * @param {string} [fallback='/']
 * @returns {string}
 */
export function parseReturnTo(formData, fallback = '/') {
  const returnTo = formData.get('returnTo')?.toString();
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return fallback;
  }
  return returnTo;
}
```

- [ ] **Step 2: Strip core imports from `libs/api/admin`**

Move any function that calls `isHookAbort` to `#/core/events/http.server.js` (or inline in admin API layout). Keep `parseOptionalJsonBody`, `requireOneOfMethods`, pagination parsers in libs.

- [ ] **Step 3: Delete `app/libs/api/storefront` after migration**

- [ ] **Step 4: Tests + commit**

Run: `npm run test -- app/core/storefront app/libs/api`

```bash
git commit -m "refactor: move storefront page context into core; purify libs/api"
```

### Task 5: Enforce boundary with oxlint

**Files:**

- Modify: `.oxlintrc.json`
- Modify: `.cursor/rules/libs-core.mdc` — note config lives in `#/libs/config`
- Modify: `CLAUDE.md` / `AGENTS.md` one-liner if they mention config under core

- [ ] **Step 1: Add override**

```json
{
  "files": ["app/libs/**/*.js", "app/libs/**/*.jsx"],
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["#/core", "#/core/**"],
            "message": "libs must not import core (core → libs only). Move domain helpers into app/core or inject callbacks from bootstrap."
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Run lint and fix any remaining violations**

Run: `npm run lint`
Expected: PASS (or only pre-existing fmt noise)

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(lint): forbid libs imports of core"
```

---

## Phase B — Durable domain events via queue job (item 4)

### Task 6: Add `domain_event` queue job and enqueue from `emit`

**Files:**

- Create: `app/core/events/job.server.js`
- Create: `app/core/events/job.test.server.js`
- Modify: `app/core/events/index.server.js`
- Modify: `app/core/events/index.test.server.js`
- Modify: `app/core/bootstrap/index.server.js` — side-effect `import '#/core/events/job.server'`
- Test: `app/core/events/index.test.server.js`, `app/core/events/job.test.server.js`

**Interfaces:**

- Produces: `dispatchHandlers(event, payload): void` (runs registered post-hook handlers; errors logged per handler)
- Produces: `setEventJobEnqueuer(fn | null)` where `fn(event, payload) => void`
- Produces: `queueDomainEvent(event, payload)` and LiteQuu job name `domain_event`
- Changes: `emit(event, payload)` calls enqueuer (or no-ops with warn if unset in production paths); **does not** run handlers inline
- Unchanged: `emitBefore`, `on`, `off`, `deny`, `HookAbortError`, `isHookAbort`

Design notes (match emails/webhooks):

- Payload must be JSON-serializable (already true for domain emits).
- Worker calls `dispatchHandlers` so email/`on(...)` subscribers still run, then may enqueue further jobs (welcome email, webhook delivery) — acceptable double hop; durability is at the event edge.
- Tests: default `setEventJobEnqueuer((event, payload) => dispatchHandlers(event, payload))` in event tests (sync), replacing today’s `flushEmit` microtask dance where needed.

- [ ] **Step 1: Write failing tests for queued emit**

```js
// app/core/events/index.test.server.js (adjust)
it('emit enqueues via setEventJobEnqueuer without running handlers inline', () => {
  const enqueued = [];
  setEventJobEnqueuer((event, payload) => {
    enqueued.push({ event, payload });
  });
  const handler = vi.fn();
  on('order.created', handler);

  emit('order.created', { orderId: '1' });

  expect(enqueued).toEqual([
    { event: 'order.created', payload: { orderId: '1' } },
  ]);
  expect(handler).not.toHaveBeenCalled();
});

it('dispatchHandlers runs registered handlers and isolates failures', async () => {
  const ok = vi.fn();
  on('order.created', () => {
    throw new Error('boom');
  });
  on('order.created', ok);
  dispatchHandlers('order.created', { orderId: '1' });
  await flushMicrotasks();
  expect(ok).toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement events core changes**

```js
/** @type {null | ((event: string, payload: unknown) => void)} */
let eventJobEnqueuer = null;

/**
 * @param {typeof eventJobEnqueuer} fn
 */
export function setEventJobEnqueuer(fn) {
  eventJobEnqueuer = fn;
}

/**
 * Run post-hook handlers for an event (used by the queue worker and tests).
 * @param {string} event
 * @param {unknown} payload
 * @returns {void}
 */
export function dispatchHandlers(event, payload) {
  const eventHandlers = handlers.get(event) ?? [];
  for (const handler of eventHandlers) {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => {
        logger.error(
          { err, event },
          `Event handler error for "${event}" — continuing dispatch`
        );
      });
  }
}

/**
 * Persist a domain event for async handler dispatch.
 * @param {string} event
 * @param {unknown} payload
 * @returns {void}
 */
export function emit(event, payload) {
  if (!eventJobEnqueuer) {
    logger.warn(
      { event },
      'emit called before event job enqueuer was set — dropping event'
    );
    return;
  }
  eventJobEnqueuer(event, payload);
}
```

Keep `emitBefore` exactly as today (sync, fail-closed). If `emitBefore` internally calls `emit('hook.blocked', ...)`, that goes through the queue too — correct.

- [ ] **Step 3: Implement job module (email-job pattern)**

```js
// app/core/events/job.server.js
import logger from '#/utils/logger.server';
import queue, { defineQueueJob } from '#/libs/queue.server';
import {
  dispatchHandlers,
  setEventJobEnqueuer,
} from '#/core/events/index.server';

const domainEventJob = defineQueueJob(queue, 'domain_event', {
  process: async (taskData) => {
    const { event, payload } = taskData;
    if (!event || typeof event !== 'string') {
      logger.warn(
        { taskData },
        'domain_event job missing event name; skipping'
      );
      return;
    }
    dispatchHandlers(event, payload);
  },
  onFailed: {
    message: 'Domain event job failed',
    source: 'core/events/job.server domainEventJob',
  },
});

/**
 * @param {string} event
 * @param {unknown} payload
 */
export function queueDomainEvent(event, payload) {
  logger.info({ event }, 'Queueing domain event');
  domainEventJob.add({ event, payload });
}

setEventJobEnqueuer(queueDomainEvent);
```

- [ ] **Step 4: Load job from bootstrap**

Next to other job imports in `app/core/bootstrap/index.server.js`:

```js
import '#/core/events/job.server';
```

Ensure this runs **before** any request can `emit`. Order relative to email job import: events job must register the enqueuer before emits; email `on(...)` registrations can load anytime before the worker processes jobs.

- [ ] **Step 5: Fix tests that assumed in-process emit**

Any test that `emit`s and expects handlers without importing the job should call:

```js
setEventJobEnqueuer((event, payload) => dispatchHandlers(event, payload));
```

in `beforeEach`, or import `#/core/events/job.server` and mock `queue`.

- [ ] **Step 6: Run tests**

Run: `npm run test -- app/core/events app/emails/job app/core/webhooks app/core/bootstrap`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/core/events app/core/bootstrap
git commit -m "feat(events): queue domain events via LiteQuu job"
```

---

## Phase C — Sales channel on purchase path (item 2)

### Task 7: Persist `salesChannelId` on cart and checkout session

**Files:**

- Modify: `app/core/cart/index.server.js` — `createCart({ currency, customerId, salesChannelId })`
- Modify: `app/core/checkout/pipeline.server.js` — `createCheckoutSession` accepts/copies `salesChannelId` (prefer cart’s channel when omitted)
- Modify: `app/routes/storefront/cart/index.jsx` — resolve channel, pass id
- Modify: `app/routes/storefront/checkout/index.jsx` — ensure session inherits cart channel
- Modify: `app/routes/api/v1/cart.jsx` — optional channel from request/host
- Modify: cart + checkout tests
- Test: `app/core/cart/index.test.server.js`, `app/core/checkout/index.test.server.js`

**Interfaces:**

- `createCart({ currency?, customerId?, salesChannelId? })` writes `salesChannelId` on `Cart`
- `createCheckoutSession(cartId, { customerId?, email?, salesChannelId? })` writes session channel; default = `cart.salesChannelId`
- `placeOrder` already copies `session.salesChannelId` — verify with a test that non-null session channel lands on `Order`

- [ ] **Step 1: Failing tests**

```js
it('createCart persists salesChannelId', async () => {
  // mock prisma.cart.create
  await createCart({ currency: 'USD', salesChannelId: 'ch_1' });
  expect(prisma.cart.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ salesChannelId: 'ch_1' }),
  });
});

it('createCheckoutSession copies salesChannelId from cart when omitted', async () => {
  prisma.cart.findUnique / lock path → cart with salesChannelId: 'ch_1'
  await createCheckoutSession('cart_1');
  expect(prisma.checkoutSession.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ salesChannelId: 'ch_1' }),
  });
});
```

- [ ] **Step 2: Implement cart**

```js
export async function createCart({
  currency = 'USD',
  customerId,
  salesChannelId,
} = {}) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + CART_EXPIRY_MS);
  const cart = await prisma.cart.create({
    data: {
      token,
      currency,
      customerId,
      expiresAt,
      salesChannelId: salesChannelId ?? null,
    },
  });
  emit('cart.created', {
    cartId: cart.id,
    token: cart.token,
    currency: cart.currency,
    customerId: cart.customerId,
    salesChannelId: cart.salesChannelId,
    expiresAt: cart.expiresAt,
  });
  return cart;
}
```

- [ ] **Step 3: Implement checkout session create**

Load cart (or use lockCart return if available). Set:

```js
salesChannelId: salesChannelId ?? cart.salesChannelId ?? null,
```

Include `salesChannelId` on `checkout.started` payload.

- [ ] **Step 4: Wire storefront + API routes**

```js
const channel = await resolveChannelFromRequest(request);
cart = await createCart({
  currency,
  customerId,
  salesChannelId: channel?.id,
});
```

Checkout route: if creating a session from an existing cart, rely on cart copy; still pass `channel?.id` when creating a brand-new cart+session in one flow.

- [ ] **Step 5: Tests + commit**

Run: `npm run test -- app/core/cart app/core/checkout app/core/orders app/routes/storefront/cart app/routes/api/v1/cart`

```bash
git commit -m "fix(channels): thread salesChannelId through cart and checkout"
```

---

## Phase D — Split mega-modules / cut cycles (item 3)

### Task 8: Split `app/core/orders/index.server.js`

**Files:**

- Create:
  - `app/core/orders/place.server.js` — `placeOrder`, `attachPaymentIntent`
  - `app/core/orders/fulfillment.server.js` — shipments, `markShipped`, `markDelivered`, fulfillment sync helpers
  - `app/core/orders/refunds.server.js` — `createRefund` (returns may import this)
  - `app/core/orders/admin.server.js` — list/load/serialize/status/notes admin helpers
  - `app/core/orders/payment-handlers.server.js` — `registerPaymentEventHandlers`
- Modify: `app/core/orders/index.server.js` → re-export barrel only
- Modify: `app/core/checkout/storefront.server.js` — import `placeOrder` from `#/core/orders/place.server` (not barrel if that pulls totals cycle)
- Keep: `address-snapshot.js` as-is
- Test: existing `app/core/orders/index.test.server.js` still passes (import from barrel)

**Cycle rule:** `place.server.js` may import checkout `session.server` / `totals.server`. Checkout storefront may import `place.server` only. `orders/index.server` must not be imported by checkout if the barrel re-exports checkout-facing and checkout-importing symbols in a way that cycles — prefer direct deep imports from checkout → `place.server`.

- [ ] **Step 1: Extract without behavior change** (move functions + update relative imports)

- [ ] **Step 2: Fix admin order route dynamic import** if the cycle is gone — prefer static imports

- [ ] **Step 3: Run orders + checkout + returns tests**

Run: `npm run test -- app/core/orders app/core/checkout app/core/returns app/routes/admin/orders`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(orders): split place, fulfillment, refunds, and admin modules"
```

### Task 9: Split plugins mega-module + provider registry table

**Files:**

- Create:
  - `app/core/plugins/ctx.server.js` — `buildCtx` / lifecycle ctx
  - `app/core/plugins/providers.server.js` — provider type table + register/unregister
  - `app/core/plugins/lifecycle.server.js` — `enable` / `disable` / `setPluginEnabledState` / order
  - `app/core/plugins/registry.server.js` — `definePlugin`, discover, list/get, `__resetRegistry`
  - `app/core/plugins/blocks.server.js` — `getPluginBlocksForSlot`
- Modify: `app/core/plugins/index.server.js` → barrel
- Modify: `docs/plugins.md` only if signatures change (prefer no public API change)

**Provider table shape:**

```js
/** @type {Record<string, {
 *   register: (id: string, spec: object) => void,
 *   unregister: (id: string) => void,
 *   exclusive?: boolean,
 * }>} */
export const PROVIDER_TYPE_HANDLERS = {
  payment: {
    register: registerPaymentProvider,
    unregister: unregisterPaymentProvider,
  },
  shipping: {
    register: registerShippingProvider,
    unregister: unregisterShippingProvider,
  },
  tax: { register: registerTaxProvider, unregister: unregisterTaxProvider },
  search: {
    register: registerSearchProvider,
    unregister: unregisterSearchProvider,
  },
  address_validation: {/* ... */},
  email: {
    register: registerEmailProvider,
    unregister: unregisterEmailProvider,
    exclusive: true,
  },
};
```

Loop `Object.entries(defineProviders(providerMap))` and dispatch via the table instead of a growing `switch`.

- [ ] **Step 1: Extract + keep barrel exports stable**

- [ ] **Step 2: Tests**

Run: `npm run test -- app/core/plugins app/core/bootstrap`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(plugins): split registry/lifecycle/providers and unify provider table"
```

---

## Phase E — Plugin dispatcher completeness (item 5)

### Task 10: Add `action` to storefront + admin plugin dispatchers

**Files:**

- Modify: `app/routes/storefront/apps/$pluginId.jsx`
- Modify: `app/routes/admin/plugins/$pluginId.jsx`
- Modify/Create tests beside those routes
- Docs: `docs/plugins.md` — document `loader` + `action` on route descriptors

**Interfaces:**

- Route descriptors may export `action({ request, params })`
- Dispatcher `action` resolves the same descriptor as loader and invokes `descriptor.action` when present; otherwise 405 JSON/HTML-friendly error

- [ ] **Step 1: Failing route test** — mock `resolvePluginStorefrontRoute` returning `{ action: vi.fn() }`, POST, expect action called

- [ ] **Step 2: Implement**

```js
export async function action({ request, params }) {
  const pluginSlug = params.pluginId ?? '';
  const splatPath = params['*'] ?? '';
  const manifest = getRegisteredPluginBySlug(pluginSlug);
  if (!manifest || !(await isPluginEnabled(manifest.id))) {
    throw new Response('Not Found', { status: 404 });
  }
  const descriptor = resolveServerRoute(pluginSlug, splatPath);
  if (!descriptor || typeof descriptor.action !== 'function') {
    throw new Response('Method Not Allowed', { status: 405 });
  }
  return descriptor.action({ request, params });
}
```

Mirror for admin (admin may skip `isPluginEnabled` if today’s loader does — match loader policy).

- [ ] **Step 3: Tests + commit**

```bash
git commit -m "feat(plugins): support actions on storefront and admin dispatchers"
```

### Task 11: Richer plugin route path matching

**Files:**

- Modify: `app/core/plugins/routes/index.js`
- Modify: `app/core/plugins/routes` tests (create if missing)
- Keep exact-match as highest priority; add `:param` segments and optional trailing `*` splat

**Interfaces:**

- `resolvePluginRouteDescriptor` returns descriptor plus `params` map when matched
- Dispatchers merge `params` into RR `params` when calling loader/action

Matching algorithm (simple, no full path-to-regexp dependency):

1. Normalize paths (existing helper).
2. Exact match wins.
3. Else try pattern match: split on `/`; `:name` captures; trailing `*` captures rest as `splat`.
4. First registered matching pattern wins (document registration order).

- [ ] **Step 1: Tests for `:id` and `*`**

```js
expect(resolvePluginRouteDescriptor(map, 'demo', 'orders/abc').path).toBe(
  'orders/:id'
);
```

- [ ] **Step 2: Implement + thread params through dispatchers**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(plugins): support param and splat paths in plugin route matching"
```

---

## Phase F — Platform honesty (item 6)

### Task 12: Docs + plugin ctx contract

**Files:**

- Modify: `docs/before-hooks-plan.md` — status → **implemented** with delta (wired actions list; payload transform still reserved)
- Modify: `docs/plugins.md` — fix `ctx.queue` (real LiteQuu wrapper, not stub); document `ctx.db` as escape hatch discouraged in favor of domain APIs; document dispatcher `action` + path patterns
- Modify: `docs/postgres.md` — already notes queue SQLite; add explicit “not multi-tenant; sales channels ≠ tenants”
- Modify: `docs/oss-competitor-roadmap_b3f9a1c7.md` — fix stale W8 rows (dispatcher/slots)
- Modify: `app/core/plugins/ctx.server.js` (after Task 10) — JSDoc on `db`: `@deprecated Prefer domain APIs; raw Prisma bypasses invariants`
- Modify: `.cursor/rules/libs-core.mdc` — config path `#/libs/config`; events durability via `#/core/events/job.server`

No schema multi-tenant work. No forced removal of `ctx.db` in this plan (would break plugins); documentation + deprecation only.

- [ ] **Step 1: Edit docs as above**

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: align architecture docs with libs boundary, events job, and plugins"
```

### Task 13: Final validation gate

- [ ] **Step 1: Full preflight**

```bash
npm run lint
npm run build
npm run test
```

Expected: lint/build exit 0; tests green (fix any regressions from queued `emit`).

- [ ] **Step 2: Grep guardrails**

```bash
rg "from '#/core" app/libs --glob '*.{js,jsx}'   # must be empty
rg "setEventJobEnqueuer|queueDomainEvent" app/core/events
rg "salesChannelId" app/core/cart/index.server.js app/core/checkout/pipeline.server.js
```

- [ ] **Step 3: Final commit only if fixes were needed**

---

## Suggested PR slicing

| PR  | Tasks | Title sketch                                                     |
| --- | ----- | ---------------------------------------------------------------- |
| 1   | 1–5   | `refactor: restore libs/core boundary and move config to libs`   |
| 2   | 6     | `feat(events): queue domain events via LiteQuu job`              |
| 3   | 7     | `fix(channels): thread salesChannelId through cart and checkout` |
| 4   | 8–9   | `refactor: split orders and plugins mega-modules`                |
| 5   | 10–11 | `feat(plugins): dispatcher actions and param routes`             |
| 6   | 12–13 | `docs: architecture honesty pass`                                |

---

## Self-review checklist

1. **Spec coverage:** Items 1–6 mapped to Phases A–F; item 1 uses hard-cut move-config (no `#/core/config` shim) + relocate-helpers + inject-emit + oxlint; item 4 uses LiteQuu `domain_event` job (not transactional outbox).
2. **Placeholders:** None intentional; test snippets for auth hook may need the exported `notifyCustomerRegistered` helper shown in Task 2.
3. **Type/name consistency:** `setEventJobEnqueuer` / `queueDomainEvent` / `dispatchHandlers` / `setOnCustomerRegistered` / `loadStorefrontPageContext` / `PROVIDER_TYPE_HANDLERS` used consistently.
4. **`emitBefore`:** Explicitly unchanged / sync.
5. **Email job interaction:** Subscribers still use `on()`; they run inside the domain_event worker and may enqueue email jobs — durable event edge preserved.
