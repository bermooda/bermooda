# MCP Analytics Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose sales and ops analytics to agents via split Admin API report routes and hybrid MCP tools (`get_dashboard_report` + focused slice tools).

**Architecture:** Domain logic stays in `app/core/reporting`. New `getOpsMetrics` powers `GET /api/admin/v1/reports/ops` and is composed into the existing dashboard report. Split Admin API routes wrap existing sales helpers 1:1. @bermooda/mcp adds thin `AdminClient` methods and `registerReportingTools`.

**Tech Stack:** React Router 7 Admin API routes, Prisma via `#/libs/prisma.server`, Vitest, @bermooda/mcp (`@modelcontextprotocol/sdk`, Zod, `runTool`).

**Spec:** [docs/superpowers/specs/2026-07-25-mcp-analytics-reports-design.md](../specs/2026-07-25-mcp-analytics-reports-design.md)

## Global Constraints

- MCP is a thin HTTP client over `/api/admin/v1` — no Prisma in @bermooda/mcp.
- Do not implement Phase 2 (customers / inventory / export metrics) in this plan.
- Do not add `reports:read` API key scope; do not migrate Admin UI home off `loadAdminDashboardData`.
- Dashboard response is additive: existing fields unchanged; add `ops` only.
- In `app/`, JavaScript + JSDoc; `#/*` imports; no file extensions in imports.
- Work spans two repos: commit bermooda changes in `/Users/cvgellhorn/dev/bermooda/bermooda`, MCP changes in `/Users/cvgellhorn/dev/bermooda/mcp`.

## File Structure

| File                                                    | Responsibility                                              |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `app/core/reporting/index.server.js`                    | Add `getOpsMetrics`; extend `getDashboardReport` with `ops` |
| `app/core/reporting/index.test.server.js`               | Unit tests for ops + updated dashboard composition          |
| `app/routes/api/admin/v1/reports/overview.jsx`          | `GET` → `{ overview }`                                      |
| `app/routes/api/admin/v1/reports/sales-over-time.jsx`   | `GET` → `{ salesOverTime }`                                 |
| `app/routes/api/admin/v1/reports/sales-by-product.jsx`  | `GET` → `{ salesByProduct }`                                |
| `app/routes/api/admin/v1/reports/sales-by-category.jsx` | `GET` → `{ salesByCategory }`                               |
| `app/routes/api/admin/v1/reports/ops.jsx`               | `GET` → `{ ops }`                                           |
| `app/routes/api/admin/v1/reports/dashboard.jsx`         | Unchanged handler (picks up `ops` from core)                |
| `app/routes.js`                                         | Register new report routes                                  |
| `docs/api.md`                                           | Document all report paths                                   |
| `docs/openapi.yaml`                                     | Add report paths                                            |
| `docs/agent-integration.md`                             | Mention reporting tools                                     |
| `.cursor/skills/bermooda-agent/SKILL.md`                | Tool table row for reporting                                |
| `@bermooda/mcp/src/client.js`                           | Report client methods                                       |
| `@bermooda/mcp/src/tools/reporting.js`                  | Hybrid MCP tools                                            |
| `@bermooda/mcp/src/tools/index.js`                      | Export `registerReportingTools`                             |
| `@bermooda/mcp/src/server.js`                           | Register reporting tools                                    |
| `@bermooda/mcp/test/client.test.js`                     | Client URL/auth coverage for reports                        |
| `@bermooda/mcp/test/server.test.js`                     | Expect new tool names                                       |
| `@bermooda/mcp/README.md`                               | Tool table                                                  |

---

### Task 1: `getOpsMetrics` (TDD)

**Files:**

- Modify: `app/core/reporting/index.server.js`
- Modify: `app/core/reporting/index.test.server.js`

- [ ] **Step 1: Extend the prisma mock and write failing tests**

In `app/core/reporting/index.test.server.js`, add `findMany` under `productVariant` in the `vi.mock`, import `getOpsMetrics`, and add:

```js
it('getOpsMetrics ranges abandoned/recent and snapshots low stock', async () => {
  prisma.checkoutSession.count.mockResolvedValue(4);
  prisma.order.findMany.mockResolvedValue([
    {
      id: 'ord_1',
      orderNumber: 1001,
      email: 'buyer@example.com',
      status: 'paid',
      totalCents: 2500,
      currency: 'USD',
      createdAt: new Date('2026-01-15T12:00:00.000Z'),
      customer: { email: 'buyer@example.com' },
    },
  ]);
  prisma.productVariant.count.mockResolvedValue(2);
  prisma.productVariant.findMany.mockResolvedValue([
    {
      id: 'var_1',
      sku: 'SKU-1',
      inventoryCount: 1,
      product: { title: 'Hat' },
    },
  ]);

  const ops = await getOpsMetrics({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    limit: 10,
  });

  expect(ops.abandonedCheckouts).toBe(4);
  expect(ops.recentOrders).toEqual([
    expect.objectContaining({
      id: 'ord_1',
      createdAt: '2026-01-15T12:00:00.000Z',
    }),
  ]);
  expect(ops.lowStock).toEqual({
    threshold: 5,
    count: 2,
    variants: [
      expect.objectContaining({
        id: 'var_1',
        sku: 'SKU-1',
        inventoryCount: 1,
        title: 'Hat',
      }),
    ],
  });
  expect(ops.range.start).toBe('2026-01-01T00:00:00.000Z');
  expect(ops.range.end).toBe('2026-01-31T23:59:59.999Z');
  expect(typeof ops.asOf).toBe('string');

  const abandonedWhere = prisma.checkoutSession.count.mock.calls[0][0].where;
  expect(abandonedWhere.step).toEqual({ not: 'complete' });
  expect(abandonedWhere.createdAt.gte.toISOString()).toBe(
    '2026-01-01T00:00:00.000Z'
  );
  expect(abandonedWhere.createdAt.lte.toISOString()).toBe(
    '2026-01-31T23:59:59.999Z'
  );
  expect(abandonedWhere.createdAt.lt).toBeInstanceOf(Date);

  const recentArgs = prisma.order.findMany.mock.calls[0][0];
  expect(recentArgs.take).toBe(10);
  expect(recentArgs.where.createdAt).toEqual({
    gte: expect.any(Date),
    lte: expect.any(Date),
  });

  const lowStockWhere = prisma.productVariant.count.mock.calls[0][0].where;
  expect(lowStockWhere).toEqual({
    inventoryTracked: true,
    inventoryCount: { lt: 5 },
  });
  expect(prisma.productVariant.findMany.mock.calls[0][0].where).toEqual(
    lowStockWhere
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (in bermooda):

```bash
npm run test -- app/core/reporting/index.test.server.js
```

Expected: FAIL — `getOpsMetrics` is not exported / not a function.

- [ ] **Step 3: Implement `getOpsMetrics`**

Add to `app/core/reporting/index.server.js` (near `loadAdminDashboardData`):

```js
const LOW_STOCK_THRESHOLD = 5;

/**
 * Operational metrics for agents and dashboards.
 * Abandoned checkouts and recent orders respect the date range;
 * low stock is a current snapshot.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} [params]
 * @returns {Promise<{
 *   range: { start: string, end: string },
 *   asOf: string,
 *   abandonedCheckouts: number,
 *   recentOrders: Array<Record<string, unknown>>,
 *   lowStock: {
 *     threshold: number,
 *     count: number,
 *     variants: Array<{
 *       id: string,
 *       sku: string | null,
 *       inventoryCount: number,
 *       title: string | null,
 *     }>,
 *   },
 * }>}
 */
export async function getOpsMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = buildCreatedAtFilter(range);
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const lowStockWhere = {
    inventoryTracked: true,
    inventoryCount: { lt: LOW_STOCK_THRESHOLD },
  };

  const [abandonedCheckouts, recentOrders, lowStockCount, lowStockVariants] =
    await Promise.all([
      prisma.checkoutSession.count({
        where: {
          step: { not: 'complete' },
          createdAt: {
            gte: dateFilter.gte,
            lte: dateFilter.lte,
            lt: oneHourAgo,
          },
        },
      }),
      prisma.order.findMany({
        where: { createdAt: dateFilter },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          email: true,
          status: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          customer: { select: { email: true } },
        },
      }),
      prisma.productVariant.count({ where: lowStockWhere }),
      prisma.productVariant.findMany({
        where: lowStockWhere,
        take: limit,
        orderBy: { inventoryCount: 'asc' },
        select: {
          id: true,
          sku: true,
          inventoryCount: true,
          product: { select: { title: true } },
        },
      }),
    ]);

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    asOf: new Date().toISOString(),
    abandonedCheckouts,
    recentOrders: recentOrders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })),
    lowStock: {
      threshold: LOW_STOCK_THRESHOLD,
      count: lowStockCount,
      variants: lowStockVariants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        inventoryCount: variant.inventoryCount,
        title: variant.product?.title ?? null,
      })),
    },
  };
}
```

Note: Prisma `createdAt: { gte, lte, lt }` is AND semantics — sessions must be in range and older than 1h. If SQLite/Prisma rejects combining `lte` and `lt`, clamp the upper bound in JS instead:

```js
const abandonedUpper =
  dateFilter.lte.getTime() < oneHourAgo.getTime() ? dateFilter.lte : oneHourAgo;
// where.createdAt: { gte: dateFilter.gte, lte: abandonedUpper }
```

Prefer the clamp approach if the multi-key filter fails in tests or runtime.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- app/core/reporting/index.test.server.js
```

Expected: PASS for the new test (other tests still green).

- [ ] **Step 5: Commit (bermooda)**

```bash
git add app/core/reporting/index.server.js app/core/reporting/index.test.server.js
git commit -m "$(cat <<'EOF'
feat(reporting): add getOpsMetrics for ranged ops KPIs

Abandoned checkouts and recent orders respect the report date range;
low stock remains a current inventory snapshot for agents.
EOF
)"
```

---

### Task 2: Compose `ops` into `getDashboardReport`

**Files:**

- Modify: `app/core/reporting/index.server.js`
- Modify: `app/core/reporting/index.test.server.js`

- [ ] **Step 1: Update the failing expectation**

Change the `getDashboardReport composes all sections` test to stub ops Prisma calls and expect `ops`:

```js
it('getDashboardReport composes all sections', async () => {
  prisma.order.aggregate.mockResolvedValue({
    _sum: {
      totalCents: 1000,
      taxCents: 100,
      discountCents: 0,
      subtotalCents: 900,
    },
    _count: 1,
  });
  prisma.order.count.mockResolvedValue(1);
  prisma.refund.aggregate.mockResolvedValue({
    _sum: { amountCents: 0 },
    _count: 0,
  });
  prisma.checkoutSession.count
    .mockResolvedValueOnce(1) // overview completed
    .mockResolvedValueOnce(1) // overview started
    .mockResolvedValueOnce(0); // ops abandoned
  prisma.order.findMany.mockResolvedValue([]);
  prisma.orderLine.findMany.mockResolvedValue([]);
  prisma.productVariant.count.mockResolvedValue(0);
  prisma.productVariant.findMany.mockResolvedValue([]);

  const report = await getDashboardReport({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });

  expect(report).toEqual({
    overview: expect.objectContaining({ revenueCents: 1000 }),
    salesOverTime: [],
    salesByProduct: [],
    salesByCategory: [],
    ops: expect.objectContaining({
      abandonedCheckouts: 0,
      lowStock: expect.objectContaining({ count: 0, threshold: 5 }),
    }),
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- app/core/reporting/index.test.server.js
```

Expected: FAIL — `ops` missing from report object.

- [ ] **Step 3: Extend `getDashboardReport`**

```js
export async function getDashboardReport(params = {}) {
  const [overview, salesOverTime, salesByProduct, salesByCategory, ops] =
    await Promise.all([
      getOverviewMetrics(params),
      getSalesOverTime(params),
      getSalesByProduct(params),
      getSalesByCategory(params),
      getOpsMetrics(params),
    ]);

  return { overview, salesOverTime, salesByProduct, salesByCategory, ops };
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- app/core/reporting/index.test.server.js
```

Expected: PASS.

- [ ] **Step 5: Commit (bermooda)**

```bash
git add app/core/reporting/index.server.js app/core/reporting/index.test.server.js
git commit -m "$(cat <<'EOF'
feat(reporting): include ops section in dashboard report

Compose getOpsMetrics into getDashboardReport so Admin API and MCP
dashboard tools return sales and ops KPIs together.
EOF
)"
```

---

### Task 3: Split Admin API report routes

**Files:**

- Create: `app/routes/api/admin/v1/reports/overview.jsx`
- Create: `app/routes/api/admin/v1/reports/sales-over-time.jsx`
- Create: `app/routes/api/admin/v1/reports/sales-by-product.jsx`
- Create: `app/routes/api/admin/v1/reports/sales-by-category.jsx`
- Create: `app/routes/api/admin/v1/reports/ops.jsx`
- Modify: `app/routes.js` (near existing `reports/dashboard` route ~line 262)

- [ ] **Step 1: Add route modules**

`overview.jsx`:

```js
// GET /api/admin/v1/reports/overview — sales overview KPIs
import {
  getOverviewMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const overview = await getOverviewMetrics(params);
  return Response.json({ overview });
}
```

`sales-over-time.jsx`:

```js
// GET /api/admin/v1/reports/sales-over-time — daily sales buckets
import {
  getSalesOverTime,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const salesOverTime = await getSalesOverTime(params);
  return Response.json({ salesOverTime });
}
```

`sales-by-product.jsx`:

```js
// GET /api/admin/v1/reports/sales-by-product — top products by revenue
import {
  getSalesByProduct,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const salesByProduct = await getSalesByProduct(params);
  return Response.json({ salesByProduct });
}
```

`sales-by-category.jsx`:

```js
// GET /api/admin/v1/reports/sales-by-category — revenue by category
import {
  getSalesByCategory,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const salesByCategory = await getSalesByCategory(params);
  return Response.json({ salesByCategory });
}
```

`ops.jsx`:

```js
// GET /api/admin/v1/reports/ops — abandoned checkouts, recent orders, low stock
import {
  getOpsMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const ops = await getOpsMetrics(params);
  return Response.json({ ops });
}
```

Leave `dashboard.jsx` as-is (it already calls `getDashboardReport`).

- [ ] **Step 2: Register routes in `app/routes.js`**

Replace the single dashboard report line with:

```js
      route('reports/overview', 'routes/api/admin/v1/reports/overview.jsx'),
      route(
        'reports/sales-over-time',
        'routes/api/admin/v1/reports/sales-over-time.jsx'
      ),
      route(
        'reports/sales-by-product',
        'routes/api/admin/v1/reports/sales-by-product.jsx'
      ),
      route(
        'reports/sales-by-category',
        'routes/api/admin/v1/reports/sales-by-category.jsx'
      ),
      route('reports/ops', 'routes/api/admin/v1/reports/ops.jsx'),
      route('reports/dashboard', 'routes/api/admin/v1/reports/dashboard.jsx'),
```

- [ ] **Step 3: Quick JSDoc/tsc check on reporting core (touched export)**

```bash
npx -p typescript tsc --noEmit --allowJs --checkJs --strict \
  --module preserve --moduleResolution bundler --target es2020 --jsx react-jsx \
  "app/core/reporting/index.server.js"
```

Expected: no errors (or only pre-existing unrelated ones — fix any new ones from `getOpsMetrics`).

- [ ] **Step 4: Commit (bermooda)**

```bash
git add app/routes/api/admin/v1/reports app/routes.js
git commit -m "$(cat <<'EOF'
feat(api): split admin report endpoints for analytics slices

Add overview, sales-over-time, sales-by-product, sales-by-category,
and ops routes alongside the existing dashboard composer.
EOF
)"
```

---

### Task 4: Document Admin API (api.md + OpenAPI)

**Files:**

- Modify: `docs/api.md` (Reports section ~739)
- Modify: `docs/openapi.yaml` (add paths under Admin)

- [ ] **Step 1: Replace the Reports section in `docs/api.md`**

```markdown
### Reports

Shared query params (where relevant): `startDate`, `endDate` (ISO date `YYYY-MM-DD`), `limit` (default 20, max 100), `locale` (default shop locale).

Paid sales metrics use order statuses `paid`, `fulfilled`, and `refunded`.

#### `GET /api/admin/v1/reports/overview`

Overview KPIs for the range: revenue, paid/total orders, tax, discounts, refunds, AOV, checkout conversion.

**Response:** `{ "overview": { ... } }`

#### `GET /api/admin/v1/reports/sales-over-time`

Daily buckets: orders, revenue, tax, discounts.

**Response:** `{ "salesOverTime": [ ... ] }`

#### `GET /api/admin/v1/reports/sales-by-product`

Top products by revenue (`limit`).

**Response:** `{ "salesByProduct": [ ... ] }`

#### `GET /api/admin/v1/reports/sales-by-category`

Revenue by category (`limit`, titles honor `locale`).

**Response:** `{ "salesByCategory": [ ... ] }`

#### `GET /api/admin/v1/reports/ops`

Operational metrics: abandoned checkouts and recent orders (date-ranged); low stock count + sample variants (current snapshot).

**Response:** `{ "ops": { "range", "asOf", "abandonedCheckouts", "recentOrders", "lowStock" } }`

#### `GET /api/admin/v1/reports/dashboard`

Composed payload: overview, salesOverTime, salesByProduct, salesByCategory, and ops.

**Response:** `{ "report": { ... } }`
```

- [ ] **Step 2: Add OpenAPI paths**

Insert before `components:` (or near other admin paths) in `docs/openapi.yaml`:

```yaml
/api/admin/v1/reports/overview:
  get:
    summary: Sales overview KPIs
    tags: [Admin]
    security: [{ bearerAuth: [] }]
    parameters:
      - { name: startDate, in: query, schema: { type: string, format: date } }
      - { name: endDate, in: query, schema: { type: string, format: date } }
      - {
          name: limit,
          in: query,
          schema: { type: integer, minimum: 1, maximum: 100 },
        }
      - { name: locale, in: query, schema: { type: string } }
    responses:
      '200':
        description: Overview metrics

/api/admin/v1/reports/sales-over-time:
  get:
    summary: Daily sales buckets
    tags: [Admin]
    security: [{ bearerAuth: [] }]
    parameters:
      - { name: startDate, in: query, schema: { type: string, format: date } }
      - { name: endDate, in: query, schema: { type: string, format: date } }
    responses:
      '200':
        description: Sales over time

/api/admin/v1/reports/sales-by-product:
  get:
    summary: Top products by revenue
    tags: [Admin]
    security: [{ bearerAuth: [] }]
    parameters:
      - { name: startDate, in: query, schema: { type: string, format: date } }
      - { name: endDate, in: query, schema: { type: string, format: date } }
      - {
          name: limit,
          in: query,
          schema: { type: integer, minimum: 1, maximum: 100 },
        }
      - { name: locale, in: query, schema: { type: string } }
    responses:
      '200':
        description: Sales by product

/api/admin/v1/reports/sales-by-category:
  get:
    summary: Revenue by category
    tags: [Admin]
    security: [{ bearerAuth: [] }]
    parameters:
      - { name: startDate, in: query, schema: { type: string, format: date } }
      - { name: endDate, in: query, schema: { type: string, format: date } }
      - {
          name: limit,
          in: query,
          schema: { type: integer, minimum: 1, maximum: 100 },
        }
      - { name: locale, in: query, schema: { type: string } }
    responses:
      '200':
        description: Sales by category

/api/admin/v1/reports/ops:
  get:
    summary: Operational metrics (abandoned, recent orders, low stock)
    tags: [Admin]
    security: [{ bearerAuth: [] }]
    parameters:
      - { name: startDate, in: query, schema: { type: string, format: date } }
      - { name: endDate, in: query, schema: { type: string, format: date } }
      - {
          name: limit,
          in: query,
          schema: { type: integer, minimum: 1, maximum: 100 },
        }
    responses:
      '200':
        description: Ops metrics

/api/admin/v1/reports/dashboard:
  get:
    summary: Composed sales + ops dashboard report
    tags: [Admin]
    security: [{ bearerAuth: [] }]
    parameters:
      - { name: startDate, in: query, schema: { type: string, format: date } }
      - { name: endDate, in: query, schema: { type: string, format: date } }
      - {
          name: limit,
          in: query,
          schema: { type: integer, minimum: 1, maximum: 100 },
        }
      - { name: locale, in: query, schema: { type: string } }
    responses:
      '200':
        description: Full dashboard report
```

- [ ] **Step 3: Commit (bermooda)**

```bash
git add docs/api.md docs/openapi.yaml
git commit -m "$(cat <<'EOF'
docs: document split admin report API endpoints

Document overview, sales slices, ops, and dashboard routes in api.md
and OpenAPI for agent and MCP consumers.
EOF
)"
```

---

### Task 5: @bermooda/mcp AdminClient report methods

**Files:**

- Modify: `/Users/cvgellhorn/dev/bermooda/mcp/src/client.js`
- Modify: `/Users/cvgellhorn/dev/bermooda/mcp/test/client.test.js`

- [ ] **Step 1: Write failing client test**

Add to `test/client.test.js` inside `describe('AdminClient')`:

```js
it('getDashboardReport and slice methods hit report routes', async () => {
  const fetchFn = vi.fn(async (url) => {
    const href = String(url);
    expect(href).toContain('/api/admin/v1/reports/');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, href }),
    };
  });

  const client = new AdminClient(
    { baseUrl: 'http://localhost:5173', apiKey: 'berm_test' },
    { fetch: fetchFn }
  );

  await client.getOverviewKpis({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });
  await client.getSalesOverTime({ startDate: '2026-01-01' });
  await client.getTopProducts({ limit: 5 });
  await client.getSalesByCategory({ locale: 'en' });
  await client.getOpsMetrics({ limit: 10 });
  await client.getDashboardReport({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    limit: 20,
  });

  const urls = fetchFn.mock.calls.map(([u]) => String(u));
  expect(urls[0]).toContain('/reports/overview?');
  expect(urls[0]).toContain('startDate=2026-01-01');
  expect(urls[1]).toContain('/reports/sales-over-time?');
  expect(urls[2]).toContain('/reports/sales-by-product?');
  expect(urls[2]).toContain('limit=5');
  expect(urls[3]).toContain('/reports/sales-by-category?');
  expect(urls[4]).toContain('/reports/ops?');
  expect(urls[5]).toContain('/reports/dashboard?');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/cvgellhorn/dev/bermooda/mcp && npm test -- test/client.test.js
```

Expected: FAIL — methods undefined.

- [ ] **Step 3: Add client methods**

Append to `AdminClient` in `src/client.js` (before closing `}` of the class):

```js
  // --- Reports ---------------------------------------------------------

  /** @param {Record<string, string | number | boolean | undefined>} [query] */
  async getOverviewKpis(query = {}) {
    return this.request('/api/admin/v1/reports/overview', { query });
  }

  /** @param {Record<string, string | number | boolean | undefined>} [query] */
  async getSalesOverTime(query = {}) {
    return this.request('/api/admin/v1/reports/sales-over-time', { query });
  }

  /** @param {Record<string, string | number | boolean | undefined>} [query] */
  async getTopProducts(query = {}) {
    return this.request('/api/admin/v1/reports/sales-by-product', { query });
  }

  /** @param {Record<string, string | number | boolean | undefined>} [query] */
  async getSalesByCategory(query = {}) {
    return this.request('/api/admin/v1/reports/sales-by-category', { query });
  }

  /** @param {Record<string, string | number | boolean | undefined>} [query] */
  async getOpsMetrics(query = {}) {
    return this.request('/api/admin/v1/reports/ops', { query });
  }

  /** @param {Record<string, string | number | boolean | undefined>} [query] */
  async getDashboardReport(query = {}) {
    return this.request('/api/admin/v1/reports/dashboard', { query });
  }
```

Confirm `request` already serializes `query` (same as `listProducts`).

- [ ] **Step 4: Run client tests**

```bash
cd /Users/cvgellhorn/dev/bermooda/mcp && npm test -- test/client.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit (@bermooda/mcp)**

```bash
cd /Users/cvgellhorn/dev/bermooda/mcp
git add src/client.js test/client.test.js
git commit -m "$(cat <<'EOF'
feat(client): add Admin API methods for report endpoints

Wire overview, sales slices, ops, and dashboard report GETs for MCP tools.
EOF
)"
```

---

### Task 6: MCP reporting tools

**Files:**

- Create: `/Users/cvgellhorn/dev/bermooda/mcp/src/tools/reporting.js`
- Modify: `/Users/cvgellhorn/dev/bermooda/mcp/src/tools/index.js`
- Modify: `/Users/cvgellhorn/dev/bermooda/mcp/src/server.js`
- Modify: `/Users/cvgellhorn/dev/bermooda/mcp/test/server.test.js`

- [ ] **Step 1: Update server test expectations (fail first)**

In `test/server.test.js`, extend `expected` with:

```js
      'get_overview_kpis',
      'get_sales_over_time',
      'get_top_products',
      'get_sales_by_category',
      'get_ops_metrics',
      'get_dashboard_report',
```

- [ ] **Step 2: Run server test to verify it fails**

```bash
cd /Users/cvgellhorn/dev/bermooda/mcp && npm test -- test/server.test.js
```

Expected: FAIL — tools missing.

- [ ] **Step 3: Implement `registerReportingTools`**

Create `src/tools/reporting.js`:

```js
import { z } from 'zod';

import { runTool } from '../lib/result.js';

const reportQuerySchema = {
  startDate: z
    .string()
    .optional()
    .describe('Inclusive start date YYYY-MM-DD (default: 30 days ago)'),
  endDate: z
    .string()
    .optional()
    .describe('Inclusive end date YYYY-MM-DD (default: today)'),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Max rows for ranked lists (default 20, max 100)'),
  locale: z.string().optional().describe('Locale for category titles'),
};

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('../client.js').AdminClient} client
 */
export function registerReportingTools(server, client) {
  server.registerTool(
    'get_overview_kpis',
    {
      title: 'Get overview KPIs',
      description:
        'Sales overview for a date range: revenue, paid orders, AOV, refunds, checkout conversion.',
      inputSchema: reportQuerySchema,
    },
    async (args) => runTool(() => client.getOverviewKpis(args))
  );

  server.registerTool(
    'get_sales_over_time',
    {
      title: 'Get sales over time',
      description:
        'Daily sales buckets (orders, revenue, tax, discounts) for a date range.',
      inputSchema: {
        startDate: reportQuerySchema.startDate,
        endDate: reportQuerySchema.endDate,
      },
    },
    async (args) => runTool(() => client.getSalesOverTime(args))
  );

  server.registerTool(
    'get_top_products',
    {
      title: 'Get top products',
      description: 'Top products by paid revenue in a date range.',
      inputSchema: reportQuerySchema,
    },
    async (args) => runTool(() => client.getTopProducts(args))
  );

  server.registerTool(
    'get_sales_by_category',
    {
      title: 'Get sales by category',
      description:
        'Paid revenue rolled up by product category for a date range.',
      inputSchema: reportQuerySchema,
    },
    async (args) => runTool(() => client.getSalesByCategory(args))
  );

  server.registerTool(
    'get_ops_metrics',
    {
      title: 'Get ops metrics',
      description:
        'Abandoned checkouts and recent orders (date-ranged) plus current low-stock snapshot.',
      inputSchema: {
        startDate: reportQuerySchema.startDate,
        endDate: reportQuerySchema.endDate,
        limit: reportQuerySchema.limit,
      },
    },
    async (args) => runTool(() => client.getOpsMetrics(args))
  );

  server.registerTool(
    'get_dashboard_report',
    {
      title: 'Get dashboard report',
      description:
        'Full analytics payload: overview, sales over time, top products, sales by category, and ops metrics.',
      inputSchema: reportQuerySchema,
    },
    async (args) => runTool(() => client.getDashboardReport(args))
  );
}
```

Export from `src/tools/index.js`:

```js
export { registerReportingTools } from './reporting.js';
```

Wire in `src/server.js`:

```js
import {
  // ...existing
  registerReportingTools,
} from './tools/index.js';

// inside createServer, after inventory tools:
registerReportingTools(server, client);
```

- [ ] **Step 4: Add a focused handler smoke test**

In `test/server.test.js`:

```js
it('get_overview_kpis forwards query to client', async () => {
  const client = {
    getOverviewKpis: vi.fn(async () => ({
      overview: { revenueCents: 1000 },
    })),
  };
  const { server } = createServer({
    config: BASE_CONFIG,
    client: /** @type {any} */ (client),
  });
  const handler = server._registeredTools.get_overview_kpis.handler;
  const result = await handler(
    { startDate: '2026-01-01', endDate: '2026-01-31' },
    {}
  );
  expect(client.getOverviewKpis).toHaveBeenCalledWith({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  });
  expect(result.isError).toBeFalsy();
  expect(result.content[0].text).toContain('1000');
});
```

- [ ] **Step 5: Run MCP tests**

```bash
cd /Users/cvgellhorn/dev/bermooda/mcp && npm test
```

Expected: PASS.

- [ ] **Step 6: Commit (@bermooda/mcp)**

```bash
git add src/tools/reporting.js src/tools/index.js src/server.js test/server.test.js
git commit -m "$(cat <<'EOF'
feat(mcp): add hybrid reporting tools for shop analytics

Expose overview, sales slices, ops metrics, and full dashboard report
tools backed by Admin API report endpoints.
EOF
)"
```

---

### Task 7: Agent docs (README + skill + agent-integration)

**Files:**

- Modify: `/Users/cvgellhorn/dev/bermooda/mcp/README.md`
- Modify: `/Users/cvgellhorn/dev/bermooda/bermooda/.cursor/skills/bermooda-agent/SKILL.md`
- Modify: `/Users/cvgellhorn/dev/bermooda/bermooda/docs/agent-integration.md`

- [ ] **Step 1: Update MCP README tool table**

Add a Reports section (or rows) listing:

| Tool                    | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `get_overview_kpis`     | Revenue, orders, AOV, conversion for a range  |
| `get_sales_over_time`   | Daily sales buckets                           |
| `get_top_products`      | Top products by revenue                       |
| `get_sales_by_category` | Revenue by category                           |
| `get_ops_metrics`       | Abandoned checkouts, recent orders, low stock |
| `get_dashboard_report`  | Full composed analytics payload               |

- [ ] **Step 2: Update bermooda-agent skill table**

Add row:

| Need             | Tool                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Analytics / KPIs | `get_dashboard_report`, `get_overview_kpis`, `get_sales_over_time`, `get_top_products`, `get_sales_by_category`, `get_ops_metrics` |

- [ ] **Step 3: Mention reporting in `docs/agent-integration.md`**

Near the tools bullet list, add that reporting tools map to `/api/admin/v1/reports/*` (overview, sales slices, ops, dashboard).

- [ ] **Step 4: Commit each repo**

```bash
cd /Users/cvgellhorn/dev/bermooda/mcp
git add README.md
git commit -m "$(cat <<'EOF'
docs: list reporting MCP tools in README
EOF
)"

cd /Users/cvgellhorn/dev/bermooda
git add .cursor/skills/bermooda-agent/SKILL.md docs/agent-integration.md
git commit -m "$(cat <<'EOF'
docs: document reporting tools for agent integration
EOF
)"
```

---

### Task 8: Final verification

- [ ] **Step 1: bermooda reporting tests + lint touched area**

```bash
cd /Users/cvgellhorn/dev/bermooda
npm run test -- app/core/reporting/index.test.server.js
npm run lint
```

If `oxfmt --check` fails: `npm run fmt`, then re-run `npm run lint`.

- [ ] **Step 2: @bermooda/mcp full test**

```bash
cd /Users/cvgellhorn/dev/bermooda/mcp
npm test
```

- [ ] **Step 3: Manual smoke (optional if shop running)**

With `BERMOODA_URL` + `BERMOODA_API_KEY` set:

```bash
curl -s -H "Authorization: Bearer $BERMOODA_API_KEY" \
  "$BERMOODA_URL/api/admin/v1/reports/overview?startDate=2026-01-01&endDate=2026-01-31" | head
curl -s -H "Authorization: Bearer $BERMOODA_API_KEY" \
  "$BERMOODA_URL/api/admin/v1/reports/ops" | head
```

Expected: JSON with `overview` / `ops` keys, HTTP 200.

---

## Spec coverage checklist

| Spec requirement                                              | Task                          |
| ------------------------------------------------------------- | ----------------------------- |
| `getOpsMetrics` (ranged abandoned/recent, snapshot low stock) | Task 1                        |
| `getDashboardReport` includes `ops`                           | Task 2                        |
| Split Admin API routes                                        | Task 3                        |
| Keep `/reports/dashboard` composer                            | Task 3 (existing file)        |
| api.md + OpenAPI                                              | Task 4                        |
| MCP hybrid tools                                              | Tasks 5–6                     |
| Agent docs / skill / README                                   | Task 7                        |
| Phase 2 customers/inventory/exports                           | Out of scope (design only)    |
| No new API scopes / no Admin UI migration                     | Honored in Global Constraints |

## Out of scope reminder

Phase 2 report endpoints (`/reports/customers`, `/reports/inventory`, `/reports/exports`) and matching MCP tools are **not** part of this plan — implement from the design spec in a later plan.
