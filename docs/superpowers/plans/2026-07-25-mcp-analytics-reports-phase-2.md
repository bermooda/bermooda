# MCP Analytics Reports Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose customer, inventory, and export analytics via split Admin API report routes and matching MCP tools (`get_customer_metrics`, `get_inventory_metrics`, `get_export_metrics`).

**Architecture:** Same as v1 — MCP thin HTTP client → `/api/admin/v1/reports/*` → `app/core/reporting` → Prisma. Domain logic stays in the shop. Do **not** fold Phase 2 into `getDashboardReport` (keep composer = sales + ops only).

**Tech Stack:** React Router 7 Admin API routes, Prisma, Vitest, @bermooda/mcp (`AdminClient`, Zod, `runTool`).

**Spec:** [docs/superpowers/specs/2026-07-25-mcp-analytics-reports-design.md](../specs/2026-07-25-mcp-analytics-reports-design.md) — Phase 2 section.

**Prerequisite:** v1 analytics merged (PR #134 / #5): `getOpsMetrics`, split sales/ops routes, MCP `registerReportingTools`.

---

## Global Constraints

- Guest/checkout orders with `customerId == null` are **excluded** from customer metrics (document in JSDoc).
- Inventory report is a **snapshot** (ignore `startDate`/`endDate` except they may still be accepted and ignored).
- Export `failureRate` and schedule counts use the report date range on `ExportRun.createdAt` / schedule `createdAt` as specified per metric below.
- Do not add Phase 2 sections to `getDashboardReport`.
- Do not re-implement inventory CRUD or scheduled-export run/download as “metrics.”
- No new `reports:read` API key scope.
- In `app/`, JavaScript + JSDoc; `#/*` imports; no file extensions.
- Work spans two repos: bermooda then @bermooda/mcp.

## Locked product decisions

| Topic                    | Decision                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `newCustomers`           | `Customer.createdAt` in range (signup), not first order                                                                                      |
| `returningCustomers`     | Distinct `customerId` with ≥2 **all-time** paid orders and ≥1 paid order **in range**                                                        |
| `ordersByNewVsReturning` | Paid orders in range with `customerId`; **new** = customer’s `createdAt` in range; **returning** = customer’s `createdAt` before range start |
| `topCustomers`           | Paid revenue in range by `customerId`, top `limit`, include email/name                                                                       |
| Low-stock threshold      | Reuse/export `LOW_STOCK_THRESHOLD = 5` (same as ops)                                                                                         |
| Product titles           | `loadProductTitleMap` from `#/core/catalog/translations.server` (Product has no `title` column)                                              |
| Stock value currency     | Shop `defaultCurrency` from settings (optional query `currency` override)                                                                    |
| `byLocation`             | Aggregate `InventoryLevel.quantity` joined to `Location`                                                                                     |

## File Structure

| File                                                                  | Responsibility                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `app/core/reporting/index.server.js`                                  | Add `getCustomerMetrics`, `getInventoryMetrics`, `getExportMetrics`; export `LOW_STOCK_THRESHOLD` |
| `app/core/reporting/index.test.server.js`                             | Unit tests for the three reporters                                                                |
| `app/routes/api/admin/v1/reports/customers.jsx`                       | `GET` → `{ customers }`                                                                           |
| `app/routes/api/admin/v1/reports/inventory.jsx`                       | `GET` → `{ inventory }`                                                                           |
| `app/routes/api/admin/v1/reports/exports.jsx`                         | `GET` → `{ exports }`                                                                             |
| `app/routes.js`                                                       | Register the three routes                                                                         |
| `docs/api.md`, `docs/openapi.yaml`                                    | Document paths                                                                                    |
| `.cursor/skills/bermooda-agent/SKILL.md`, `docs/agent-integration.md` | Agent tool table                                                                                  |
| `@bermooda/mcp/src/client.js`                                         | Three client methods                                                                              |
| `@bermooda/mcp/src/tools/reporting.js`                                | Three MCP tools                                                                                   |
| `@bermooda/mcp/test/client.test.js`, `test/server.test.js`            | Coverage                                                                                          |
| `@bermooda/mcp/README.md`                                             | Tool rows                                                                                         |

---

### Task 1: `getCustomerMetrics` (TDD)

**Files:**

- Modify: `app/core/reporting/index.server.js`
- Modify: `app/core/reporting/index.test.server.js`

- [ ] **Step 1: Extend prisma mock and write failing test**

In the test file’s `vi.mock`, ensure:

```js
    customer: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
```

(keep existing `order` mocks). Import `getCustomerMetrics`. Add:

```js
it('getCustomerMetrics splits new vs returning and ranks top spenders', async () => {
  prisma.customer.count.mockResolvedValue(3);
  prisma.order.findMany
    // all-time paid: c1×2, c2×2, c3×1 → returning candidates {c1,c2}
    .mockResolvedValueOnce([
      { customerId: 'c1' },
      { customerId: 'c1' },
      { customerId: 'c2' },
      { customerId: 'c2' },
      { customerId: 'c3' },
    ])
    // in-range paid: c1 once (signup before range), c2 twice (signup in range)
    .mockResolvedValueOnce([
      {
        customerId: 'c1',
        totalCents: 5000,
        customer: {
          id: 'c1',
          email: 'a@example.com',
          name: 'A',
          createdAt: new Date('2025-06-01T00:00:00.000Z'),
        },
      },
      {
        customerId: 'c2',
        totalCents: 3000,
        customer: {
          id: 'c2',
          email: 'b@example.com',
          name: 'B',
          createdAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      },
      {
        customerId: 'c2',
        totalCents: 2000,
        customer: {
          id: 'c2',
          email: 'b@example.com',
          name: 'B',
          createdAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      },
    ]);

  const result = await getCustomerMetrics({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    limit: 10,
  });

  expect(result.newCustomers).toBe(3);
  expect(result.returningCustomers).toBe(2);
  expect(result.ordersByNewVsReturning).toEqual({
    new: { orders: 2, revenueCents: 5000 },
    returning: { orders: 1, revenueCents: 5000 },
  });
  expect(result.topCustomers[0]).toEqual(
    expect.objectContaining({
      customerId: 'c2',
      email: 'b@example.com',
      revenueCents: 5000,
      orderCount: 2,
    })
  );
  expect(result.range.start).toBe('2026-01-01T00:00:00.000Z');
});
```

- [ ] **Step 2: Run test — expect FAIL** (`getCustomerMetrics` missing)

```bash
npm run test -- app/core/reporting/index.test.server.js
```

- [ ] **Step 3: Implement `getCustomerMetrics`**

```js
/**
 * Customer analytics for a date range.
 * Guest orders (null customerId) are excluded from order-based metrics.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} [params]
 */
export async function getCustomerMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = buildCreatedAtFilter(range);
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );
  const paid = { status: { in: PAID_ORDER_STATUSES } };

  const [newCustomers, allTimePaidCustomerIds, rangedPaidOrders] =
    await Promise.all([
      prisma.customer.count({ where: { createdAt: dateFilter } }),
      prisma.order.findMany({
        where: { ...paid, customerId: { not: null } },
        select: { customerId: true },
      }),
      prisma.order.findMany({
        where: {
          ...paid,
          customerId: { not: null },
          createdAt: dateFilter,
        },
        select: {
          customerId: true,
          totalCents: true,
          customer: {
            select: { id: true, email: true, name: true, createdAt: true },
          },
        },
      }),
    ]);

  /** @type {Map<string, number>} */
  const allTimeCount = new Map();
  for (const row of allTimePaidCustomerIds) {
    if (!row.customerId) continue;
    allTimeCount.set(
      row.customerId,
      (allTimeCount.get(row.customerId) ?? 0) + 1
    );
  }

  const returningIds = new Set(
    [...allTimeCount.entries()]
      .filter(([, count]) => count >= 2)
      .map(([id]) => id)
  );

  const rangedCustomerIds = new Set(
    rangedPaidOrders.map((o) => o.customerId).filter(Boolean)
  );
  let returningCustomers = 0;
  for (const id of returningIds) {
    if (rangedCustomerIds.has(id)) returningCustomers += 1;
  }

  const ordersByNewVsReturning = {
    new: { orders: 0, revenueCents: 0 },
    returning: { orders: 0, revenueCents: 0 },
  };

  /** @type {Map<string, { customerId: string, email: string | null, name: string | null, revenueCents: number, orderCount: number }>} */
  const topMap = new Map();

  for (const order of rangedPaidOrders) {
    if (!order.customerId || !order.customer) continue;
    const isNew =
      order.customer.createdAt.getTime() >= range.start.getTime() &&
      order.customer.createdAt.getTime() <= range.end.getTime();
    const bucket = isNew
      ? ordersByNewVsReturning.new
      : ordersByNewVsReturning.returning;
    bucket.orders += 1;
    bucket.revenueCents += order.totalCents;

    const row = topMap.get(order.customerId) ?? {
      customerId: order.customerId,
      email: order.customer.email,
      name: order.customer.name,
      revenueCents: 0,
      orderCount: 0,
    };
    row.revenueCents += order.totalCents;
    row.orderCount += 1;
    topMap.set(order.customerId, row);
  }

  const topCustomers = [...topMap.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, limit);

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    newCustomers,
    returningCustomers,
    ordersByNewVsReturning,
    topCustomers,
  };
}
```

Note: loading all paid `customerId`s all-time may be heavy at scale; acceptable for v1 shops / SQLite. Do not introduce a new aggregation table in this plan.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm run test -- app/core/reporting/index.test.server.js
```

- [ ] **Step 5: Commit (bermooda)**

```bash
git add app/core/reporting/index.server.js app/core/reporting/index.test.server.js
git commit -m "$(cat <<'EOF'
feat(reporting): add getCustomerMetrics for customer analytics

Expose new/returning customer KPIs and top spenders for Admin API and MCP.
EOF
)"
```

---

### Task 2: `getInventoryMetrics` (TDD)

**Files:**

- Modify: `app/core/reporting/index.server.js`
- Modify: `app/core/reporting/index.test.server.js`

- [ ] **Step 1: Export threshold + failing test**

Change `const LOW_STOCK_THRESHOLD = 5` to `export const LOW_STOCK_THRESHOLD = 5`.

Extend prisma mock:

```js
    inventoryLevel: {
      findMany: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
    },
    variantPrice: {
      findMany: vi.fn(),
    },
```

Mock settings if needed — prefer injecting currency via params for the unit test:

```js
it('getInventoryMetrics snapshots stock, value, and by-location', async () => {
  prisma.productVariant.findMany.mockResolvedValue([
    {
      id: 'v1',
      sku: 'SKU-1',
      inventoryCount: 2,
      productId: 'p1',
    },
    {
      id: 'v2',
      sku: 'SKU-2',
      inventoryCount: 0,
      productId: 'p2',
    },
  ]);
  prisma.variantPrice.findMany.mockResolvedValue([
    { variantId: 'v1', priceCents: 1000 },
    { variantId: 'v2', priceCents: 500 },
  ]);
  prisma.inventoryLevel.findMany.mockResolvedValue([
    { locationId: 'loc1', variantId: 'v1', quantity: 2 },
    { locationId: 'loc1', variantId: 'v2', quantity: 0 },
  ]);
  prisma.location.findMany.mockResolvedValue([
    { id: 'loc1', name: 'Warehouse', code: 'WH' },
  ]);

  // Mock translation titles via vi.mock on translations if getInventoryMetrics calls loadProductTitleMap.
  // Prefer stubbing loadProductTitleMap:
});
```

Prefer mocking the translations module:

```js
vi.mock('#/core/catalog/translations.server', () => ({
  loadProductTitleMap: vi.fn(
    async () =>
      new Map([
        ['p1', 'Hat'],
        ['p2', 'Cap'],
      ])
  ),
  loadCategoryTitleMap: vi.fn(async () => new Map()),
}));
```

(Keep `loadCategoryTitleMap` if existing sales tests need it — check current imports in reporting and extend the mock rather than replacing a full mock that breaks sales tests.)

If `loadCategoryTitleMap` is already imported without a mock, add only:

```js
vi.mock('#/core/catalog/translations.server', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadProductTitleMap: vi.fn(
      async () =>
        new Map([
          ['p1', 'Hat'],
          ['p2', 'Cap'],
        ])
    ),
  };
});
```

Assertions:

```js
const inv = await getInventoryMetrics({ currency: 'USD', limit: 10 });
expect(inv.asOf).toEqual(expect.any(String));
expect(inv.lowStock.count).toBe(1); // v1 only (< 5 and > 0) OR include OOS — design: lowStock = below threshold; OOS separate
expect(inv.outOfStock.count).toBe(1);
expect(inv.stockValueCents).toBe(2000); // 2*1000 + 0*500
expect(inv.byLocation[0]).toEqual(
  expect.objectContaining({
    locationId: 'loc1',
    name: 'Warehouse',
    units: 2,
  })
);
```

Define **lowStock** as tracked variants with `0 < inventoryCount < threshold` **or** `inventoryCount < threshold` including zero? Spec lists lowStock and outOfStock separately → **lowStock = `inventoryCount > 0 && inventoryCount < threshold`**, **outOfStock = `inventoryCount === 0`**. Both require `inventoryTracked: true`.

- [ ] **Step 2: Run test — FAIL**

- [ ] **Step 3: Implement `getInventoryMetrics`**

```js
import { loadProductTitleMap } from '#/core/catalog/translations.server';
import { get } from '#/core/settings/index.server';
import { DEFAULT_CURRENCY } from '#/core/settings/defaults';
import { SETTING_KEYS } from '#/core/settings/keys';

/**
 * Snapshot inventory analytics (not date-ranged).
 *
 * @param {{ limit?: number, locale?: string, currency?: string, threshold?: number }} [params]
 */
export async function getInventoryMetrics(params = {}) {
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );
  const threshold = Math.max(
    Number(params.threshold) || LOW_STOCK_THRESHOLD,
    1
  );
  const locale = params.locale;
  const currency =
    params.currency?.trim() ||
    (await get(SETTING_KEYS.DEFAULT_CURRENCY)) ||
    DEFAULT_CURRENCY;

  const tracked = await prisma.productVariant.findMany({
    where: { inventoryTracked: true },
    select: {
      id: true,
      sku: true,
      inventoryCount: true,
      productId: true,
    },
  });

  const titleByProductId = await loadProductTitleMap(
    tracked.map((v) => v.productId),
    locale || undefined
  );

  const prices = await prisma.variantPrice.findMany({
    where: {
      variantId: { in: tracked.map((v) => v.id) },
      currency,
    },
    select: { variantId: true, priceCents: true },
  });
  const priceByVariant = new Map(
    prices.map((p) => [p.variantId, p.priceCents])
  );

  const lowStockVariants = tracked
    .filter((v) => v.inventoryCount > 0 && v.inventoryCount < threshold)
    .sort((a, b) => a.inventoryCount - b.inventoryCount);
  const outOfStockVariants = tracked.filter((v) => v.inventoryCount === 0);

  let stockValueCents = 0;
  for (const v of tracked) {
    stockValueCents += v.inventoryCount * (priceByVariant.get(v.id) ?? 0);
  }

  const levels = await prisma.inventoryLevel.findMany({
    select: { locationId: true, variantId: true, quantity: true },
  });
  const locations = await prisma.location.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
  });
  const locById = new Map(locations.map((l) => [l.id, l]));

  /** @type {Map<string, { locationId: string, name: string, code: string | null, units: number, stockValueCents: number }>} */
  const byLoc = new Map();
  for (const level of levels) {
    const loc = locById.get(level.locationId);
    if (!loc) continue;
    const row = byLoc.get(loc.id) ?? {
      locationId: loc.id,
      name: loc.name,
      code: loc.code,
      units: 0,
      stockValueCents: 0,
    };
    row.units += level.quantity;
    row.stockValueCents +=
      level.quantity * (priceByVariant.get(level.variantId) ?? 0);
    byLoc.set(loc.id, row);
  }

  const mapVariant = (v) => ({
    id: v.id,
    sku: v.sku,
    inventoryCount: v.inventoryCount,
    title: titleByProductId.get(v.productId) ?? null,
  });

  return {
    asOf: new Date().toISOString(),
    currency,
    threshold,
    lowStock: {
      count: lowStockVariants.length,
      variants: lowStockVariants.slice(0, limit).map(mapVariant),
    },
    outOfStock: {
      count: outOfStockVariants.length,
      variants: outOfStockVariants.slice(0, limit).map(mapVariant),
    },
    stockValueCents,
    byLocation: [...byLoc.values()].sort((a, b) => b.units - a.units),
  };
}
```

Mock `get` from `#/core/settings/index.server` in the unit test when currency is not passed via params.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add app/core/reporting/index.server.js app/core/reporting/index.test.server.js
git commit -m "$(cat <<'EOF'
feat(reporting): add getInventoryMetrics snapshot analytics

Low/out-of-stock lists, stock value, and per-location rollups for agents.
EOF
)"
```

---

### Task 3: `getExportMetrics` (TDD)

**Files:**

- Modify: `app/core/reporting/index.server.js`
- Modify: `app/core/reporting/index.test.server.js`

- [ ] **Step 1: Mock + failing test**

```js
    scheduledExport: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    exportRun: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
```

```js
it('getExportMetrics returns schedules, recent runs, and failure rate', async () => {
  prisma.scheduledExport.groupBy.mockResolvedValue([
    { exportType: 'orders', schedule: 'weekly', _count: { _all: 2 } },
  ]);
  prisma.exportRun.findMany.mockResolvedValue([
    {
      id: 'run1',
      scheduledExportId: 'se1',
      exportType: 'orders',
      status: 'failed',
      rowCount: null,
      error: 'boom',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      completedAt: new Date('2026-01-10T00:01:00.000Z'),
      fileContent: 'x',
    },
  ]);
  prisma.exportRun.count
    .mockResolvedValueOnce(10) // total in range
    .mockResolvedValueOnce(2); // failed in range

  const result = await getExportMetrics({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    limit: 5,
  });

  expect(result.schedules).toEqual([
    expect.objectContaining({
      exportType: 'orders',
      schedule: 'weekly',
      count: 2,
    }),
  ]);
  expect(result.recentRuns[0]).toEqual(
    expect.objectContaining({
      id: 'run1',
      status: 'failed',
      error: 'boom',
      hasFileContent: true,
    })
  );
  expect(result.recentRuns[0].fileContent).toBeUndefined();
  expect(result.failureRate).toEqual({
    total: 10,
    failed: 2,
    rate: 20,
  });
});
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement**

Import `serializeExportRun` from `#/core/exports/index.server` **only if** that does not create a circular dependency (`exports` already imports reporting date helpers). If circular: duplicate the small serialize shape inline (id, scheduledExportId, exportType, status, rowCount, error, createdAt, completedAt, hasFileContent) — prefer inline to avoid cycles.

```js
/**
 * Scheduled export health metrics.
 *
 * @param {{ startDate?: string, endDate?: string, limit?: number }} [params]
 */
export async function getExportMetrics(params = {}) {
  const range = parseDateRange(params);
  const dateFilter = buildCreatedAtFilter(range);
  const limit = Math.min(
    Math.max(Number(params.limit) || DEFAULT_REPORT_LIMIT, 1),
    MAX_REPORT_LIMIT
  );

  const [grouped, recentRuns, total, failed] = await Promise.all([
    prisma.scheduledExport.groupBy({
      by: ['exportType', 'schedule'],
      _count: { _all: true },
    }),
    prisma.exportRun.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        scheduledExportId: true,
        exportType: true,
        status: true,
        rowCount: true,
        error: true,
        createdAt: true,
        completedAt: true,
        fileContent: true,
      },
    }),
    prisma.exportRun.count({ where: { createdAt: dateFilter } }),
    prisma.exportRun.count({
      where: { createdAt: dateFilter, status: 'failed' },
    }),
  ]);

  return {
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    schedules: grouped.map((row) => ({
      exportType: row.exportType,
      schedule: row.schedule,
      count: row._count._all,
    })),
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      scheduledExportId: run.scheduledExportId,
      exportType: run.exportType,
      status: run.status,
      rowCount: run.rowCount,
      error: run.error,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      hasFileContent: Boolean(run.fileContent),
    })),
    failureRate: {
      total,
      failed,
      rate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
    },
  };
}
```

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit**

```bash
git add app/core/reporting/index.server.js app/core/reporting/index.test.server.js
git commit -m "$(cat <<'EOF'
feat(reporting): add getExportMetrics for export health KPIs

Schedule rollups, recent runs without CSV payloads, and failure rate.
EOF
)"
```

---

### Task 4: Admin API routes

**Files:**

- Create: `app/routes/api/admin/v1/reports/customers.jsx`
- Create: `app/routes/api/admin/v1/reports/inventory.jsx`
- Create: `app/routes/api/admin/v1/reports/exports.jsx`
- Modify: `app/routes.js`

- [ ] **Step 1: Add route modules** (same pattern as `ops.jsx`)

`customers.jsx`:

```js
// GET /api/admin/v1/reports/customers — customer analytics
import {
  getCustomerMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const customers = await getCustomerMetrics(params);
  return Response.json({ customers });
}
```

`inventory.jsx`:

```js
// GET /api/admin/v1/reports/inventory — inventory snapshot analytics
import {
  getInventoryMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const currency = url.searchParams.get('currency') || undefined;
  const thresholdRaw = url.searchParams.get('threshold');
  const threshold = thresholdRaw ? Number(thresholdRaw) : undefined;
  const inventory = await getInventoryMetrics({
    ...params,
    currency,
    threshold: Number.isFinite(threshold) ? threshold : undefined,
  });
  return Response.json({ inventory });
}
```

`exports.jsx`:

```js
// GET /api/admin/v1/reports/exports — scheduled export health metrics
import {
  getExportMetrics,
  parseReportParams,
} from '#/core/reporting/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseReportParams(url.searchParams);
  const exports = await getExportMetrics(params);
  return Response.json({ exports });
}
```

- [ ] **Step 2: Register in `app/routes.js`** next to existing report routes:

```js
      route('reports/customers', 'routes/api/admin/v1/reports/customers.jsx'),
      route('reports/inventory', 'routes/api/admin/v1/reports/inventory.jsx'),
      route('reports/exports', 'routes/api/admin/v1/reports/exports.jsx'),
```

- [ ] **Step 3: Commit**

```bash
git add app/routes/api/admin/v1/reports app/routes.js
git commit -m "$(cat <<'EOF'
feat(api): add customer, inventory, and export report endpoints

Thin Admin API wrappers over Phase 2 reporting core helpers.
EOF
)"
```

---

### Task 5: Docs (api.md + OpenAPI)

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/openapi.yaml`

- [ ] **Step 1:** Append under Reports in `docs/api.md`:

```markdown
#### `GET /api/admin/v1/reports/customers`

Customer analytics for the range: new customers, returning customers, paid orders split new vs returning, top customers by revenue.

Guest orders (no `customerId`) are excluded from order-based metrics.

**Response:** `{ "customers": { ... } }`

#### `GET /api/admin/v1/reports/inventory`

Snapshot inventory analytics: low stock, out of stock, stock value, by location.

Optional query: `currency` (default shop default), `threshold` (default 5). Date params are ignored.

**Response:** `{ "inventory": { ... } }`

#### `GET /api/admin/v1/reports/exports`

Scheduled export health: schedule counts, recent runs (no CSV body), failure rate in range.

**Response:** `{ "exports": { ... } }`
```

- [ ] **Step 2:** Add three OpenAPI paths matching existing report path style (`tags: [Admin]`, `bearerAuth`).

- [ ] **Step 3: Commit**

```bash
git add docs/api.md docs/openapi.yaml
git commit -m "$(cat <<'EOF'
docs: document Phase 2 customer, inventory, and export reports
EOF
)"
```

---

### Task 6: @bermooda/mcp AdminClient methods

**Files (@bermooda/mcp):**

- Modify: `src/client.js`
- Modify: `test/client.test.js`

- [ ] **Step 1: Failing test** asserting URLs:

- `/api/admin/v1/reports/customers`
- `/api/admin/v1/reports/inventory`
- `/api/admin/v1/reports/exports`

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Add methods**

```js
  async getCustomerMetrics(query = {}) {
    return this.request('/api/admin/v1/reports/customers', { query });
  }

  async getInventoryMetrics(query = {}) {
    return this.request('/api/admin/v1/reports/inventory', { query });
  }

  async getExportMetrics(query = {}) {
    return this.request('/api/admin/v1/reports/exports', { query });
  }
```

- [ ] **Step 4: PASS** `npm test -- test/client.test.js`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(client): add Phase 2 report Admin API methods
EOF
)"
```

---

### Task 7: MCP tools

**Files (@bermooda/mcp):**

- Modify: `src/tools/reporting.js`
- Modify: `test/server.test.js`
- Modify: `README.md`

- [ ] **Step 1:** Add expected tool names to server test:

```js
      'get_customer_metrics',
      'get_inventory_metrics',
      'get_export_metrics',
```

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Register tools** in `registerReportingTools`:

```js
server.registerTool(
  'get_customer_metrics',
  {
    title: 'Get customer metrics',
    description:
      'New/returning customers, paid order split, and top customers by revenue for a date range.',
    inputSchema: reportQuerySchema,
  },
  async (args) => runTool(() => client.getCustomerMetrics(args))
);

server.registerTool(
  'get_inventory_metrics',
  {
    title: 'Get inventory metrics',
    description:
      'Snapshot low/out-of-stock lists, stock value, and per-location units (not date-ranged).',
    inputSchema: {
      limit: reportQuerySchema.limit,
      locale: reportQuerySchema.locale,
      currency: z.string().optional(),
      threshold: z.number().int().positive().optional(),
    },
  },
  async (args) => runTool(() => client.getInventoryMetrics(args))
);

server.registerTool(
  'get_export_metrics',
  {
    title: 'Get export metrics',
    description:
      'Scheduled export counts, recent runs (no CSV), and failure rate for a date range.',
    inputSchema: {
      startDate: reportQuerySchema.startDate,
      endDate: reportQuerySchema.endDate,
      limit: reportQuerySchema.limit,
    },
  },
  async (args) => runTool(() => client.getExportMetrics(args))
);
```

Add one smoke test forwarding `get_customer_metrics` → `client.getCustomerMetrics`.

- [ ] **Step 4:** Update README tool table with the three tools.

- [ ] **Step 5:** `npm test` PASS; `npm run fmt` if needed.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mcp): add customer, inventory, and export metrics tools
EOF
)"
```

---

### Task 8: Agent docs + final verification

**Files:**

- Modify: bermooda `.cursor/skills/bermooda-agent/SKILL.md`
- Modify: bermooda `docs/agent-integration.md`

- [ ] **Step 1:** Extend Analytics / KPIs skill row with the three new tools.

- [ ] **Step 2:** Mention Phase 2 report paths in `docs/agent-integration.md`.

- [ ] **Step 3: Verification**

```bash
# bermooda
npm run test -- app/core/reporting/index.test.server.js
npm run lint
npm run build

# @bermooda/mcp
npm test
npm run lint
```

- [ ] **Step 4: Commit docs**

```bash
git commit -m "$(cat <<'EOF'
docs: document Phase 2 reporting tools for agents
EOF
)"
```

---

## Spec coverage checklist

| Spec item                                                                   | Task                         |
| --------------------------------------------------------------------------- | ---------------------------- |
| `GET /reports/customers` + metrics                                          | Tasks 1, 4                   |
| `GET /reports/inventory` + metrics                                          | Tasks 2, 4                   |
| `GET /reports/exports` + metrics                                            | Tasks 3, 4                   |
| MCP `get_customer_metrics` / `get_inventory_metrics` / `get_export_metrics` | Tasks 6–7                    |
| Dashboard stays sales+ops only                                              | Honored (Global Constraints) |
| Docs / OpenAPI / skill                                                      | Tasks 5, 8                   |

## Out of scope

- Folding Phase 2 into `getDashboardReport`
- Admin UI charts / home migration
- CSV download or run-now MCP tools
- API key scope `reports:read`
- Replacing `getOpsMetrics.lowStock` (overlap with inventory report is acceptable)

## Success criteria

- Agents can answer “new vs returning customers?”, “where is stock?”, and “are exports failing?” via MCP without Admin UI.
- Focused tools each hit one Admin API route.
- Existing v1 dashboard/sales/ops tools remain unchanged.
