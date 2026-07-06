# Design: Before-hooks / blocking filter pipeline for bermooda

Status: **design only** (no code in this document is wired up yet).
Audience: an engineer implementing the feature without re-auditing the codebase.

---

## 1. Problem statement — why post-action hooks aren't enough

The plugin system today only supports **post-action** hooks. A plugin declares
`hooks` in its manifest (`app/core/plugins/index.server.js`), those handlers are
attached to the in-process event bus via `on(event, handler)`
(`app/core/events/index.server.js`), and core emits the event **after** the
mutation has already committed.

Concrete fulfillment example (`app/core/orders/index.server.js`):

```37:511:app/core/orders/index.server.js
// addShipment: opens prisma.$transaction, creates Shipment + ShipmentLine rows,
// THEN calls: await emit('shipment.created', { shipmentId, orderId });
```

```544:616:app/core/orders/index.server.js
// markShipped: prisma.$transaction updates shipment + increments
// orderLine.fulfilledQuantity + syncOrderFulfillmentStatus, THEN calls:
// await emit('shipment.shipped', { shipmentId, orderId, ... });
```

Because the event fires after commit, and because `emit()` **catches and
swallows** handler errors for every non-`checkout.*` event, a plugin literally
cannot stop a shipment from being created or marked shipped. It can only react
after the fact.

Real merchant use cases that need a _veto_:

- Block shipping an order flagged for fraud review.
- Block fulfillment until a 3PL / ERP acknowledges stock allocation.
- Block a refund that exceeds a policy threshold or a compliance hold.
- Enforce address validation / export-control checks before an order is placed.

The event bus already contains a **latent, half-built** version of this: any
event whose name starts with `checkout.` propagates handler errors instead of
swallowing them (see `emit()` below). But **no production code emits any
`checkout.*` event**, the behavior is name-based rather than intentional, and it
provides no structured "why was this blocked" contract, no user-facing message,
and no observability. `docs/phase-1-plan.md` aspired to "only checkout-critical
paths propagate errors" but the generalized blocking mechanism was never built.

```52:74:app/core/events/index.server.js
export async function emit(event, payload) {
  const isCheckout = event.startsWith('checkout.');
  const eventHandlers = handlers.get(event) ?? [];
  for (const handler of eventHandlers) {
    if (isCheckout) {
      await handler(payload);         // errors bubble — transactional path
    } else {
      try { await handler(payload); } // errors swallowed — fault tolerant
      catch (err) { logger.error(...); }
    }
  }
}
```

A second, orthogonal defect makes any blocking feature dead-on-arrival: the
admin Plugins page toggles the `enabledPlugins` **setting** but never calls
`enable()` / `disable()`, so hook handlers (and therefore any future filters)
are only registered on the bus at process start via `enablePersistedPlugins()`.
Toggling a plugin in the UI does nothing to the live bus until the next restart.
See §8.

---

## 2. Recommended approach

**Recommendation: a `before.*` blocking filter pipeline layered on the existing
event bus, using a fail-closed, throw-to-veto contract.**

Add one new dispatcher, `emitBefore(event, payload)`, to
`app/core/events/index.server.js`. It reuses the _same_ `handlers` map and the
_same_ `on()` / `off()` registration path that post-hooks already use — the only
difference is dispatch semantics:

- Handlers for `before.<event>` are awaited in registration order.
- If a handler **throws**, dispatch stops immediately and the throw propagates
  to the domain function, which lets it abort **before** opening its DB
  transaction.
- A distinguished error class, `HookAbortError` (thrown via a `deny()` helper),
  carries a machine code + human reason + the offending `pluginId`, so core can
  translate a veto into a clean 422 instead of a 500.

Core call site pattern (fulfillment as the first target):

```js
// app/core/orders/index.server.js (addShipment, before the $transaction)
await emitBefore('shipment.create', { orderId, order, data });
// ...only reached if no filter vetoed...
const shipment = await prisma.$transaction(/* ... */);
await emit('shipment.created', { shipmentId: shipment.id, orderId }); // unchanged
```

### Why this and not the alternatives

| Option                                                 | Verdict  | Reasoning                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`before.*` on the existing bus (chosen)**            | ✅       | Smallest change that fully solves blocking. Reuses `on`/`off`, `enable`/`disable`, manifest `hooks`, `defineHooks`, `buildCtx`. Plugin authors keep one mental model: a `before.x` hook is a blocking hook. No new registry, no new manifest field.                                                                                                               |
| **Filter pipeline returning transformed values**       | ⚠️ later | A true filter (each handler returns a possibly-mutated payload that feeds the next) is more powerful but the bus currently ignores handler return values, and mutating domain payloads mid-transaction invites subtle bugs. MVP is _veto_, not _transform_. The API below reserves return values for a future transform phase without breaking the veto contract. |
| **Generic middleware chain (`use(fn)`), à la Express** | ❌       | Introduces a second extension primitive competing with the event bus. Plugins would need a new registration surface and lifecycle. Over-engineered for "let a plugin say no."                                                                                                                                                                                     |
| **Provider-registry-style veto registry**              | ❌       | The provider registry (payments/shipping/tax) is for _one selected implementation per type_. Blocking is _many observers, any can veto_ — that is exactly what the event bus already models.                                                                                                                                                                      |

The chosen approach also lets us **retire the fragile `checkout.` name-based
special case** in `emit()` (see §7): all error-propagating / blocking behavior
moves to the explicit `before.*` path, and `emit()` becomes uniformly
fault-tolerant.

---

## 3. API design

All new symbols are exported from `app/core/events/index.server.js` and
re-exported from `app/core/plugins/index.server.js` so plugin authors keep a
single import surface (they already import `defineHooks`, `definePlugin` from
there).

### 3.1 `emitBefore(event, payload)`

```js
/**
 * Run all before-filters for a domain action. Dispatches to handlers
 * registered under `before.<event>` in registration order.
 *
 * Fail-closed veto semantics: if any handler throws, dispatch stops and the
 * error propagates to the caller (the domain function), which MUST NOT have
 * started its DB transaction yet.
 *
 * @param {string} event  Bare action name WITHOUT the `before.` prefix,
 *                         e.g. 'shipment.create'. emitBefore prepends it.
 * @param {object} payload Context for the decision (never mutated in MVP).
 * @returns {Promise<object>} the payload (reserved for future transform phase).
 * @throws {HookAbortError} when a filter vetoes the action.
 */
export async function emitBefore(event, payload) {
  /* ... */
}
```

Dispatch body (pseudocode):

```js
export async function emitBefore(event, payload) {
  const key = `before.${event}`;
  for (const handler of handlers.get(key) ?? []) {
    // No try/catch: throws propagate (fail-closed). A handler that throws a
    // plain Error is treated as a veto too — but plugins SHOULD throw via deny().
    await handler(payload);
  }
  return payload;
}
```

### 3.2 `HookAbortError` and `deny()`

```js
/** Distinguished veto error. Not an operational error — a business decision. */
export class HookAbortError extends Error {
  constructor(reason, { code = 'HOOK_BLOCKED', pluginId = null } = {}) {
    super(reason);
    this.name = 'HookAbortError';
    this.code = code; // machine-readable, e.g. 'FRAUD_HOLD'
    this.reason = reason; // human-readable, safe to show a merchant
    this.pluginId = pluginId; // which plugin blocked (filled by the bus if null)
    this.blocked = true; // quick discriminator for catch blocks
  }
}

/** Throw a veto. Ergonomic sugar for plugin authors. */
export function deny(reason, opts) {
  throw new HookAbortError(reason, opts);
}

/** Type guard for route/core catch blocks. */
export function isHookAbort(err) {
  return err instanceof HookAbortError || err?.blocked === true;
}
```

To attribute the veto to a plugin without asking authors to pass `pluginId`
manually, the plugin loader wraps each `before.*` handler at registration time
(see §8) so a thrown `HookAbortError` with `pluginId === null` gets the wrapping
plugin's id stamped on it.

### 3.3 Manifest / registration — no new fields

Plugins keep using the existing `hooks` map and `defineHooks()`. A key that
starts with `before.` is a blocking filter purely by convention + dispatch path;
everything else stays a post-hook.

```js
// app/plugins/<id>/index.server.js
import { defineHooks, definePlugin, deny } from '#/core/plugins/index.server';

export const pluginManifest = definePlugin({
  ...manifest,
  hooks: defineHooks({
    'before.shipment.ship': async ({ order }) => {
      if (order.fraudHold)
        deny('Order is on fraud hold', { code: 'FRAUD_HOLD' });
    },
    'shipment.shipped': async (payload) => {
      /* post-hook, unchanged */
    },
  }),
});
```

`defineHooks` is unchanged (it only validates that values are functions).
`enable()` already iterates `manifest.hooks` and calls `on(event, handler)` for
each — `before.*` keys register automatically with no loader change beyond the
attribution wrapper.

### 3.4 Handler signature and return/throw contract

| Aspect    | Contract                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signature | `async (payload) => void` — same as post-hooks. Handlers do **not** receive `ctx`; import `#/libs/prisma.server` etc. directly (matches existing docs/sample plugin). |
| Allow     | Return normally (return value ignored in MVP).                                                                                                                        |
| Block     | `deny(reason, { code })` — or throw any error (treated as a veto, `code: 'HOOK_BLOCKED'`).                                                                            |
| Ordering  | Registration order = plugin enable order (`Setting.pluginOrder` / startup order). First veto wins; later filters do not run.                                          |
| Async     | Awaited sequentially. Keep filters fast; they run on the request's critical path before the transaction.                                                              |

### 3.5 Error codes (reserved first-wave)

| Code              | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `HOOK_BLOCKED`    | Generic veto (default when a plugin throws without a code). |
| `FRAUD_HOLD`      | Fulfillment blocked by fraud/risk check.                    |
| `INVENTORY_HOLD`  | External stock allocation not confirmed.                    |
| `REFUND_POLICY`   | Refund exceeds policy / requires approval.                  |
| `ADDRESS_INVALID` | Address validation failed pre-placement.                    |
| `COMPLIANCE_HOLD` | Export/sanctions/compliance block.                          |

Codes are just strings; plugins may define their own. Core only special-cases
none of them — the code is passed through to the HTTP response and audit log.

---

## 4. Event catalog — first-wave `before.*` events

Naming rule: `before.<domain>.<verb>` where the verb is the action the plugin is
vetoing. Payload always includes enough already-loaded context for the decision
so filters don't re-query. Payloads are **read-only** in MVP.

### MVP (ship first — fulfillment)

| Event                    | Emitted in                            | Payload                                                                                       | Blocks                                                    |
| ------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `before.shipment.create` | `addShipment()` before `$transaction` | `{ orderId, order, data }` (`order` incl. `lines`; `data` = requested carrier/tracking/lines) | Creating a shipment record                                |
| `before.shipment.ship`   | `markShipped()` before `$transaction` | `{ shipmentId, orderId, shipment, order, data }`                                              | Marking a shipment shipped / decrementing fulfillable qty |

### Wave 2 (order lifecycle + money)

| Event                     | Emitted in                                                                     | Payload                                        | Blocks                             |
| ------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------------------- |
| `before.order.place`      | `placeOrder()` **inside** tx, after session/totals load, before `order.create` | `{ checkoutSessionId, session, cart, totals }` | Order creation (rolls the tx back) |
| `before.order.cancel`     | `cancelOrder()` before inventory restore                                       | `{ orderId, order }`                           | Cancelling an order                |
| `before.refund.create`    | `createRefund()` before `refund.create`                                        | `{ orderId, order, amountCents, reason }`      | Issuing a refund                   |
| `before.shipment.deliver` | `markDelivered()`                                                              | `{ shipmentId }`                               | Marking delivered                  |

### Wave 3 (checkout flow)

| Event                     | Emitted in                                 | Payload                                              | Blocks                                                                                           |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `before.checkout.advance` | `advanceStep()` before persisting the step | `{ sessionId, session, fromStep, toStep, stepData }` | Advancing to the next checkout step (e.g. address validation on the address→shipping transition) |

**Prioritization:** implement MVP (fulfillment) end-to-end first — it is the
requested target, has a self-contained transaction boundary, and both call sites
already load the `order` with `lines`. Waves 2–3 follow the identical pattern.

`before.order.place` is the one nuance: placement runs entirely inside a
`$transaction`. Emitting the filter _inside_ the tx means a veto rolls back
cleanly, but filter handlers then run while a DB transaction is open — keep them
non-blocking / no long I/O, or (preferred) emit `before.order.place` **before**
opening the transaction using a cheap pre-read of the session. The design picks
**before the transaction** for consistency with fulfillment (see §5).

---

## 5. Core integration points

### 5.1 Fulfillment (MVP)

`addShipment(orderId, data)` — the order is already loaded with lines at the top:

```js
// app/core/orders/index.server.js
import { emit, emitBefore } from '#/core/events/index.server';

export async function addShipment(orderId, data = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const shipmentLines = data.lines ?? [];
  if (shipmentLines.length > 0)
    validateShipmentLines(order.lines, shipmentLines);

  // NEW — veto point, BEFORE any write. Throws HookAbortError to abort.
  await emitBefore('shipment.create', { orderId, order, data });

  const shipment = await prisma.$transaction(/* ...unchanged... */);
  await emit('shipment.created', { shipmentId: shipment.id, orderId });
  return shipment;
}
```

`markShipped(shipmentId, data)` — shipment + order already loaded at the top:

```js
export async function markShipped(
  shipmentId,
  { carrier, trackingNumber, trackingUrl } = {}
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { lines: true, order: { include: { lines: true } } },
  });
  if (!shipment) throw new Error('SHIPMENT_NOT_FOUND');

  // NEW — veto point, before the transaction.
  await emitBefore('shipment.ship', {
    shipmentId,
    orderId: shipment.orderId,
    shipment,
    order: shipment.order,
    data: { carrier, trackingNumber, trackingUrl },
  });

  const updated = await prisma.$transaction(/* ...unchanged... */);
  await emit('shipment.shipped', {
    shipmentId,
    orderId: shipment.orderId /* ... */,
  });
  return updated;
}
```

**Rule: `emitBefore` is always called after the entity is fetched and validated
but before `prisma.$transaction` opens.** A veto therefore never leaves a
partial write and never holds a transaction open across plugin I/O.

### 5.2 What happens on block

`emitBefore` re-throws the `HookAbortError` out of the domain function. Callers
already wrap core calls in try/catch and surface `err.message`, so blocking works
today with **zero route changes** — but the message would be raw. The clean path
adds a small discriminator:

- **HTML admin route** (`app/routes/admin/orders/$id.jsx`, `add-shipment` /
  `mark-delivered` / `add-refund` intents): the existing
  `catch (err) { return { ok: false, error: err.message }; }` already renders
  `err.reason` correctly since `HookAbortError.message === reason`. Optionally
  branch on `isHookAbort(err)` to add a "blocked by <pluginId>" note.
- **Admin API route** (`app/routes/api/admin/v1/orders/$id/shipments.jsx`):
  return `422` with `{ error: err.reason, code: err.code, blockedBy: err.pluginId }`.
  It already returns `422` for domain errors — just enrich the body when
  `isHookAbort(err)`.

No `handleError`/`sendErrorAlert` for vetoes — a block is an expected business
outcome, not an operational error (see §9).

---

## 6. Plugin author guide (example)

A fraud-hold plugin that blocks shipping any order whose customer is flagged.

```
app/plugins/fraud-guard/
  manifest.js
  index.server.js
```

`manifest.js`:

```js
export default {
  id: 'fraud-guard',
  name: 'Fraud Guard',
  version: '1.0.0',
  description: 'Blocks fulfillment of orders on a fraud hold.',
};
```

`index.server.js`:

```js
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { defineHooks, definePlugin, deny } from '#/core/plugins/index.server';
import manifest from '#/plugins/fraud-guard/manifest';

const HOLD_KEY = 'holds'; // PluginData: array of orderIds on hold

async function assertNotHeld(orderId) {
  const row = await prisma.pluginData.findUnique({
    where: { pluginId_key: { pluginId: manifest.id, key: HOLD_KEY } },
  });
  const holds = row ? JSON.parse(row.value) : [];
  if (holds.includes(orderId)) {
    logger.warn({ orderId }, 'fraud-guard: blocking fulfillment');
    // Throwing here vetoes the action. pluginId is stamped by the loader.
    deny('This order is on a fraud hold and cannot be fulfilled.', {
      code: 'FRAUD_HOLD',
    });
  }
}

export const pluginManifest = definePlugin({
  ...manifest,
  hooks: defineHooks({
    'before.shipment.create': ({ orderId }) => assertNotHeld(orderId),
    'before.shipment.ship': ({ orderId }) => assertNotHeld(orderId),
  }),
});

export default pluginManifest;
```

Author experience notes:

- Same folder layout, same `defineHooks`, same "handlers get the payload, import
  services directly" model documented in `docs/plugins.md`.
- To **allow**, do nothing. To **block**, call `deny(reason, { code })`.
- Filters run in `Setting.pluginOrder`; the first veto short-circuits the rest.
- Blocking hooks should be fast and side-effect-free (they may run and then a
  _later_ filter vetoes, or the same action is retried).

---

## 7. Relationship to the existing `checkout.*` transactional events

**Unify, don't keep two mechanisms.** The `checkout.` name-prefix branch in
`emit()` is the only place with error-propagating dispatch, it is undocumented in
the public catalog, and no production code emits `checkout.*`. Keeping it
alongside `before.*` would give the codebase two subtly different
"errors-propagate" rules.

Plan:

1. Introduce `emitBefore` as the single error-propagating / blocking path.
2. Change `emit()` to be **uniformly fault-tolerant** (drop the `isCheckout`
   branch). Post-hooks never affect the caller.
3. Any future checkout blocking uses `before.checkout.advance` (Wave 3), not a
   magic `checkout.*` name.
4. Update `app/core/events/index.test.server.js`: replace the three
   "checkout.\* rethrow" cases with equivalent `emitBefore` veto cases, and add a
   case asserting `emit('checkout.completed', ...)` now swallows handler errors
   like any other event.

This is a small, contained behavior change and is safe precisely because nothing
emits `checkout.*` today (verified by grep — only tests and unrelated
`stripe.checkout.session.*` strings match).

---

## 8. Admin enable/disable fix (prerequisite)

Before-hooks are worthless if enabling a plugin in the UI doesn't register its
filters on the live bus. Today `app/routes/admin/plugins/index.jsx` only mutates
the `enabledPlugins` setting array; it never calls the loader's `enable()` /
`disable()`, which are the functions that actually call `on()` / `off()`.

There is also a **persistence split** to reconcile:

- `enable(pluginId)` writes `plugin.<id>.enabled = true` and registers hooks.
- The admin action writes the `enabledPlugins` **array**.
- Startup `enablePersistedPlugins()` reads the `enabledPlugins` array and calls
  `enable()` for each.

So the array is the source of truth for startup, but the admin toggle bypasses
the code that touches the bus. Fix (in the `enable`/`disable` intent branch of
the admin action):

```js
// app/routes/admin/plugins/index.jsx (action, intent === 'enable'|'disable')
import { enable, disable } from '#/core/plugins/index.server';

// ...after updating the enabledPlugins array + settings.set('enabledPlugins', ...)
if (intent === 'enable')
  await enable(pluginId); // registers before.* + post hooks now
else await disable(pluginId); // off()s them now
```

Notes / cleanup for the implementer:

- `enable()` early-returns if `entry.handlers.size > 0` ("already enabled"), so
  calling it after a settings write is idempotent. `enable()` also re-writes
  `plugin.<id>.enabled`; that's harmless but the two persistence schemes should
  be documented as: **`enabledPlugins` array = persisted intent; `enable()` =
  live wiring**. Keep both writes; do not delete the array write (startup relies
  on it).
- LiteFS: this runs in a route **action**, so writes route to the primary
  automatically — **no `ensurePrimary()`** needed (per `.cursor/rules/litefs.mdc`).
- **Attribution wrapper:** update `enable()` so that when it registers a
  `before.*` handler it wraps it to stamp `pluginId` onto any thrown
  `HookAbortError`:

```js
// in enable(), when iterating manifest.hooks
const wrapped = event.startsWith('before.')
  ? async (payload) => {
      try {
        return await handler(payload);
      } catch (err) {
        if (isHookAbort(err) && !err.pluginId) err.pluginId = pluginId;
        throw err;
      }
    }
  : handler;
on(event, wrapped);
entry.handlers.set(event, wrapped); // off() must remove the SAME reference
```

Because `entry.handlers` stores the wrapped reference, `disable()`'s
`off(event, handler)` still deregisters correctly.

---

## 9. Error handling & observability

**A veto is a business decision, not an error.** Do not route it through
`handleError` / `sendErrorAlert` (those are for operational failures and page
alerts, per `.cursor/rules/alerting.mdc`).

- **Core logging:** in `emitBefore`, on a caught-then-rethrown veto, log at
  `warn` with structured fields: `logger.warn({ event, code, pluginId, reason }, 'action blocked by before-hook')`. Use `#/utils/logger.server` (never `console`).
- **User-facing message:** `HookAbortError.reason` is authored by the plugin and
  is safe to display. Admin HTML routes render it in the existing action-error
  UI; API routes return `422 { error, code, blockedBy }`.
- **Audit trail:** emit a normal post-event `hook.blocked` (fault-tolerant path)
  with `{ event, code, pluginId, reason, orderId }` so the audit subscriber
  (`registerAuditSubscribers`, `app/core/audit/index.server`) records blocks.
  This is optional for MVP but cheap and high-signal. Do **not** add
  `hook.blocked` to `WEBHOOK_EVENTS` initially.
- **Distinguish veto vs crash:** a plugin filter that throws a _non_-veto error
  (a real bug) still aborts the action (fail-closed) but logs at `error`. Both
  reach the caller; the route shows a generic message for non-veto errors. This
  fail-closed default is intentional for a blocking pipeline — a broken risk
  check must not silently allow fulfillment.

---

## 10. Testing plan

### Unit — event bus (`app/core/events/index.test.server.js`)

- `emitBefore` awaits handlers in registration order.
- A handler that `deny()`s propagates `HookAbortError` and **stops** later
  handlers (assert a spy after the throwing handler is not called).
- A handler that throws a plain `Error` also aborts (fail-closed), surfaced as
  `code: 'HOOK_BLOCKED'` after loader wrapping (test the wrapper separately).
- `emitBefore` with no registered handlers resolves and returns the payload.
- **Regression:** `emit()` now swallows errors for _all_ events including
  `checkout.*` (replace the old rethrow cases).

### Unit — plugin loader (`app/core/plugins/index.test.server.js`)

- `enable()` registers `before.*` keys on the bus; `disable()` removes them.
- The attribution wrapper stamps `pluginId` on a `HookAbortError` that lacks one,
  and leaves an explicitly-set `pluginId` untouched.
- `off()` deregisters the wrapped reference (enable→disable→emitBefore runs no
  handler).

### Unit — orders (`app/core/orders/index.test.server.js`)

- `addShipment` / `markShipped`: when a `before.*` handler vetoes, **no**
  Shipment / ShipmentLine row is written and `fulfilledQuantity` is unchanged
  (assert DB state), and the veto error propagates.
- When no filter vetoes, behavior is byte-for-byte unchanged (existing tests
  stay green).

### Integration — sample blocking plugin

- Register a `fraud-guard`-style plugin, `enable()` it, seed a hold in
  `PluginData`, assert `addShipment` throws `FRAUD_HOLD` and writes nothing;
  remove the hold, assert it succeeds and `shipment.created` fires.
- Assert the admin API shipments route returns `422 { code: 'FRAUD_HOLD' }`.

### Admin route

- Toggling enable/disable in the plugins action registers/deregisters live
  (spy on `on`/`off` or assert handlers via the event bus after `enable()`).

Run targeted: `npm run test -- orders events plugins` (or the server project).
Full preflight before any PR: `npm run lint` → `npm run build` → `npm run test`
(per `.cursor/rules/pr-preflight.mdc`).

---

## 11. Implementation phases (PR-sized)

Ordered; each is independently shippable and green.

1. **PR1 — Event bus primitive.** Add `emitBefore`, `HookAbortError`, `deny`,
   `isHookAbort` to `app/core/events/index.server.js`. Collapse the `checkout.`
   special case in `emit()`. Re-export the new symbols from
   `app/core/plugins/index.server.js`. Update `events` unit tests (§7, §10).
   _No behavior change to existing emits except checkout error-swallowing._
2. **PR2 — Live enable/disable + attribution wrapper.** Fix
   `app/routes/admin/plugins/index.jsx` to call `enable()`/`disable()`. Add the
   `before.*` attribution wrapper in `enable()`. Loader unit tests. _Prerequisite
   for filters to work at runtime._
3. **PR3 — Fulfillment integration (MVP).** Add `emitBefore('shipment.create')`
   and `emitBefore('shipment.ship')` to `orders/index.server.js`. Enrich the two
   route catch blocks (`admin/orders/$id.jsx`, `api/admin/v1/.../shipments.jsx`)
   to surface `code`/`blockedBy` for `isHookAbort` errors. Orders unit tests.
4. **PR4 — Sample plugin + docs.** Ship `app/plugins/fraud-guard/` (or extend
   `sample-analytics` with a `before.shipment.ship` example) + integration test.
   Update `docs/plugins.md`: new "Before-hooks (blocking filters)" section
   documenting the `before.*` catalog, `deny()`, return/throw contract, and the
   fail-closed rule. Add `before.*` MVP events to the hook catalog table.
5. **PR5 — Wave 2/3 extension.** Add `before.order.place`,
   `before.order.cancel`, `before.refund.create`, `before.checkout.advance` at
   the boundaries in §4, each with tests. Optional: `hook.blocked` audit event.

---

## 12. Risks & open questions

- **Fail-closed default.** A buggy filter that throws blocks the action. This is
  deliberate for fulfillment/refunds (safety over availability) but is a support
  burden. Mitigation: clear `warn`/`error` logs with `pluginId`; a broken plugin
  can be disabled from the admin (now that PR2 makes disable live). _Open q:_ do
  we want a per-event "advisory" mode where a thrown error logs but allows?
  Recommend **no** for MVP — keep semantics simple.
- **`before.order.place` transaction boundary.** Placement is fully
  transactional. The plan emits the filter _before_ opening the tx using a cheap
  session pre-read; if a filter needs the exact computed totals, we'd have to
  either emit inside the tx (holding it open across plugin I/O — discouraged) or
  compute totals twice. _Open q:_ is pre-transaction context enough for real
  placement filters? For MVP fulfillment this doesn't arise.
- **Ordering determinism.** First-veto-wins depends on `Setting.pluginOrder`.
  Two filters with conflicting opinions: order matters only for _which reason_
  the user sees, not whether it's blocked. Acceptable.
- **Performance.** Filters run synchronously on the request critical path before
  the transaction. Slow external calls (fraud APIs) add latency. Guidance in
  docs: keep filters fast; do heavy work in post-hooks or queue jobs and cache a
  decision in `PluginData` that the filter reads.
- **Persistence split (`enabledPlugins` array vs `plugin.<id>.enabled`).** PR2
  keeps both. _Open q:_ consolidate to one source of truth in a later cleanup?
  Out of scope here.
- **No transform in MVP.** If a concrete need for payload mutation (e.g. a plugin
  rewriting a shipping address) appears, extend `emitBefore` to thread handler
  return values through the chain. The signature already returns the payload to
  keep that door open without a breaking change.
