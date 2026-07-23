# Testing

## Overview

Bermooda's test suite uses [Vitest](https://vitest.dev/) with two project configurations: a `unit` project running in a happy-dom (browser-like) environment and a `server` project running in Node. This split keeps fast, isolated unit tests separate from server-side code that depends on Node APIs or Prisma.

The philosophy is to test behavior through mocks and factories rather than hitting real databases. Prisma is mocked at the module level in server tests, keeping them fast and deterministic. A DB-per-worker pattern is available for integration tests that require a real SQLite instance.

---

## File Naming Conventions

| Pattern                    | Environment | Purpose                                                   |
| -------------------------- | ----------- | --------------------------------------------------------- |
| `app/**/*.test.js`         | happy-dom   | Unit tests for pure logic, utilities, hooks               |
| `app/**/*.test.jsx`        | happy-dom   | Unit tests for JSX/React components                       |
| `app/**/*.test.server.js`  | Node        | Server-side tests: Prisma services, loaders, adapters     |
| `app/**/*.test.server.jsx` | Node        | Server-side tests for `.jsx` route modules (e.g. actions) |

Server tests use the `.test.server.js` / `.test.server.jsx` suffix so the `unit` project excludes them and the `server` project picks them up exclusively.

**Colocation:** place each test next to the module it covers. Named modules are
wrapped into a folder with an `index` entry so the test mirrors that name:

```
app/utils/slugify.js + slugify.test.js
  → app/utils/slugify/index.js + index.test.js

app/libs/error.server.js + error.server.test.js
  → app/libs/error/index.server.js + index.test.server.js
```

Dynamic-segment and layout route modules keep their filenames; tests sit beside
them (`$provider.test.jsx`, `_layout.test.jsx`).

**Examples:**

```
app/core/cart/index.test.server.js              # Mirrors index.server.js — Prisma mock, Node env
app/core/cart/lines/index.test.js               # Pure logic, happy-dom
app/components/admin/slug-field/index.test.jsx  # React component, happy-dom
app/routes/webhooks/$provider.test.jsx          # Route module, Node via routes include
```

---

## Running Tests

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `npm run test`          | Run all tests once (`vitest run`)      |
| `npm run test:watch`    | Watch mode — re-runs on file change    |
| `npm run test:coverage` | Run all tests and emit coverage report |

Both `unit` and `server` projects run together by default. To target a single project:

```sh
npx vitest run --project unit
npx vitest run --project server
```

---

## Test Setup

Both projects load `app/test-setup.js` before each test file. The setup file:

- Imports `@testing-library/jest-dom` to extend Vitest matchers with DOM assertions (`toBeInTheDocument`, `toHaveValue`, etc.)
- Calls `vi.clearAllMocks()` after every test, so mock call history and return values never bleed between tests

The `#` path alias maps to `./app`, matching the application alias:

```js
import { makeTotals } from '#core/totals/totals.js';
```

---

## Factories

Factories live in `app/test/factories/`. Each factory returns a complete, valid shape with sensible defaults. Pass an overrides object to customize specific fields.

```js
import { makeUser } from '#test/factories/user.js';

const user = makeUser({ role: 'ADMIN' });
```

| Factory                   | File          | Shape                                                  |
| ------------------------- | ------------- | ------------------------------------------------------ |
| `makeUser(overrides)`     | `user.js`     | `{ id, email, emailVerified, name, role }`             |
| `makeCustomer(overrides)` | `customer.js` | Customer shape                                         |
| `makeProduct(overrides)`  | `product.js`  | `{ id, variants[], media[], categories[], options[] }` |
| `makeVariant(overrides)`  | `variant.js`  | Variant shape                                          |
| `makeCart(overrides)`     | `cart.js`     | Cart shape                                             |
| `makeCartLine(overrides)` | `cart.js`     | CartLine shape                                         |
| `makeOrder(overrides)`    | `order.js`    | Order shape                                            |
| `makeSetting(overrides)`  | `setting.js`  | Setting shape                                          |

Factories compose naturally. Build a cart with a specific product:

```js
const variant = makeVariant({ price: 2999 });
const product = makeProduct({ variants: [variant] });
const line = makeCartLine({ variantId: variant.id, quantity: 2 });
const cart = makeCart({ lines: [line] });
```

---

## Helpers

Helpers live in `app/test/helpers/`.

### Prisma mock — `mocks.js`

`makePrismaMock(models)` returns a mock Prisma client. Pass an array of model name strings; each model gets auto-mocked methods: `findUnique`, `findFirst`, `findMany`, `create`, `update`, `upsert`, `delete`, `deleteMany`, `count`. The client also includes `$transaction`.

```js
import { makePrismaMock, makeLoggerMock } from '#test/helpers/mocks.js';
import { vi } from 'vitest';

const db = makePrismaMock(['cart', 'cartLine', 'product']);
const logger = makeLoggerMock();

vi.mock('#core/db.server.js', () => ({ db }));

test('adds a line to the cart', async () => {
  db.cart.findUnique.mockResolvedValue(makeCart());
  db.cartLine.create.mockResolvedValue(makeCartLine());

  const result = await addLineToCart(db, { cartId: 'c1', variantId: 'v1' });

  expect(db.cartLine.create).toHaveBeenCalledOnce();
  expect(result.lines).toHaveLength(1);
});
```

`makeLoggerMock()` returns a mock logger with `info`, `warn`, `error`, and `debug` methods, all `vi.fn()`.

### Database URL helper — `db.js`

`getTestDatabaseUrl(workerId)` returns the database URL for a test worker. It checks `DATABASE_URL_TEST` first, then falls back to `/tmp/bermooda-test-${workerId}.db`. Used by integration tests that need a real SQLite file.

### Request helpers — `request.js`

Utilities for constructing test requests, useful when testing Remix loaders and actions directly.

---

## DB-per-Worker Pattern

Current tests mock Prisma at the module level, which is sufficient for unit and service tests. For integration tests that need real database queries, use the DB-per-worker pattern.

Each Vitest worker gets its own SQLite file, preventing test parallelism from causing data collisions.

**When to use:**

- Testing raw SQL or Prisma query behavior
- Testing database constraints and transactions end-to-end
- When mocking Prisma would obscure the logic under test

**How it works:**

`getTestDatabaseUrl(workerId)` returns a unique DB path per worker. Set `DATABASE_URL_TEST` to use a shared path, or omit it to use the automatic `/tmp/bermooda-test-${workerId}.db` fallback.

**Running with a single worker** (required until migration isolation is added):

```sh
DATABASE_URL_TEST=file:/tmp/bermooda-test-0.db npx vitest --pool=forks --poolOptions.forks.singleFork
```

Integration test files should create and tear down their own data rather than relying on a pre-seeded database.

---

## Coverage

Coverage is collected with the v8 provider and scoped to `app/core/**`. All files in that directory are included in the report whether or not they have a test file.

### Thresholds

The following thresholds apply to `app/core/**` and are enforced in CI:

| Metric     | Threshold |
| ---------- | --------- |
| Statements | 80%       |
| Branches   | 80%       |
| Functions  | 80%       |
| Lines      | 80%       |

Dropping below any threshold causes `npm run test:coverage` to exit with a non-zero code and fails the CI build.

### Checking coverage locally

```sh
npm run test:coverage
```

The report is written to `coverage/` and printed to the terminal. Open `coverage/index.html` in a browser for line-by-line detail.

---

## Coverage Targets

The following 17 areas are the required coverage targets from the project specification. Each corresponds to one or more test files under `app/core/`.

1. **Totals engine** — subtotal, discount, shipping, and tax calculations; exact cart-currency price lookup; browsing fallback pricing; tax modes (inclusive/exclusive)

2. **Cart service** — add/remove/update line operations; currency lock behavior; snapshot pricing at add-to-cart time; cart expiry; guest-to-customer merge on login

3. **Checkout pipeline** — step transitions and validation; server-side price recompute before order creation; idempotent order creation (no duplicate orders on retry); inventory decrement on confirm

4. **Order service** — create from completed checkout; status transition rules; refund flow; fulfillment tracking

5. **Plugin loader** — manifest validation on load; hook registration and deregistration; dispatch order across plugins; error isolation (one failing hook does not abort others); `ctx.plugin.*` namespacing; enable/disable lifecycle hooks

6. **Theme resolver** — active theme resolution; manifest validation; component mapping from theme to filesystem; fallback to default theme; fail-fast on missing required component

7. **Provider registry** — register and lookup providers by type; `defineProvider` input validation

8. **i18n resolver** — locale resolution chain (request > user preference > shop default > fallback); missing-key behavior; merging plugin and theme translation catalogs

9. **Translation service** — read translations with locale fallback; write translations per locale; slug uniqueness enforcement

10. **Currency service** — active currency resolution; exact `VariantPrice` lookup for checkout; browsing price fallback; `Intl.NumberFormat` output formatting

11. **Stripe payment adapter** — `startPayment` return shape; webhook signature verification (Stripe SDK mocked); idempotent event replay; refund initiation flow

12. **Webhook idempotency** — `WebhookEvent` deduplication: replayed events with a known `eventId` are skipped without side effects

13. **Discount engine** — percent-off and fixed-amount discount types; minimum subtotal enforcement; expiry date checks; max-uses enforcement

14. **Inventory** — atomic stock decrement; race condition handling when stock reaches zero concurrently; skip decrement when `inventoryTracked` is false

15. **Auth boundaries** — admin route middleware redirects unauthenticated users; customer route middleware redirects correctly; session isolation between roles; dual auth API base paths; guest cart token rotation on login

16. **Sample plugin integration** — end-to-end test that the sample plugin's `order.created` hook fires and produces the expected side effect when dispatched through the plugin loader

17. **Default theme smoke test** — all required theme components render without error when given mock loader data; no missing-component errors on a clean render pass

---

## CI

The CI workflow (`.github/workflows/ci.yml`) runs three jobs on every pull request: `lint`, `build`, and `test`. The `test` job runs `npm run test:coverage`, which enforces the `app/core/**` 80% thresholds. A coverage regression that drops any metric below the threshold blocks the PR.
