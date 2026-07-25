# Design: MCP analytics & report APIs

**Date:** 2026-07-25  
**Status:** Approved  
**Repos:** bermooda (Admin API + `app/core/reporting`), bermooda-mcp (tools + client)

## Goal

Let agents query shop analytics via MCP: overview KPIs, sales over time, top products, sales by category, and ops metrics (abandoned checkouts, recent orders, low stock). Domain logic stays in the shop; MCP remains a thin HTTP client over Admin API.

## Decisions

| Decision | Choice |
| --- | --- |
| v1 scope | Sales report slices + ops metrics |
| Ops date behavior | Abandoned checkouts and recent orders respect `startDate`/`endDate`; low stock is a current snapshot |
| Admin API shape | Split routes per report slice (not a single sections query on one endpoint) |
| Dashboard composer | Keep `GET /reports/dashboard`; extend with `ops`; additive / backward compatible |
| MCP tool surface | Hybrid: one full `get_dashboard_report` + focused tools per slice |
| API key scopes | No new `reports:read` scope in v1 (existing admin API key gate) |
| Admin UI home | Keep `loadAdminDashboardData` for now; optional later migration to `getOpsMetrics` |
| Phase 2 | Design customers / inventory / export metric endpoints; implement later |

## Architecture

```
MCP tools (bermooda-mcp)
  → AdminClient HTTP methods
    → /api/admin/v1/reports/*
      → app/core/reporting/*.server
        → Prisma
```

Existing sales aggregations already live in `app/core/reporting/index.server.js` and power Admin UI + `GET /api/admin/v1/reports/dashboard`. v1 adds ops metrics in core, exposes split Admin API routes, and wires MCP tools.

## v1 Admin API

Shared query params (where relevant):

| Param | Default | Notes |
| --- | --- | --- |
| `startDate` | 30 days before `endDate` | `YYYY-MM-DD` |
| `endDate` | today (UTC end of day) | `YYYY-MM-DD` |
| `limit` | 20 (max 100) | Top products/categories, recent orders, low-stock sample |
| `locale` | shop default | Category title resolution |

### Routes

| Method | Path | Core function | Response envelope |
| --- | --- | --- | --- |
| `GET` | `/api/admin/v1/reports/overview` | `getOverviewMetrics` | `{ overview }` |
| `GET` | `/api/admin/v1/reports/sales-over-time` | `getSalesOverTime` | `{ salesOverTime }` |
| `GET` | `/api/admin/v1/reports/sales-by-product` | `getSalesByProduct` | `{ salesByProduct }` |
| `GET` | `/api/admin/v1/reports/sales-by-category` | `getSalesByCategory` | `{ salesByCategory }` |
| `GET` | `/api/admin/v1/reports/ops` | `getOpsMetrics` (new) | `{ ops }` |
| `GET` | `/api/admin/v1/reports/dashboard` | `getDashboardReport` (extended) | `{ report }` with all sections including `ops` |

Route modules live under `app/routes/api/admin/v1/reports/` and are registered in `app/routes.js`. Handlers stay thin: `parseReportParams` → core → `Response.json`.

### Overview payload (existing)

Includes range, order counts, paid revenue/tax/discount, refunds, AOV, checkout conversion. Paid statuses remain `paid` | `fulfilled` | `refunded`.

### Ops payload (new)

`getOpsMetrics({ startDate?, endDate?, limit? })` returns:

| Field | Behavior |
| --- | --- |
| `range` | Parsed start/end ISO for date-filtered fields |
| `asOf` | ISO timestamp for snapshot fields |
| `abandonedCheckouts` | Count of checkout sessions with `step !== 'complete'`, `createdAt` in range, and older than 1 hour (same abandonment age rule as admin home) |
| `recentOrders` | Up to `limit` orders in range, newest first (same select shape as admin home recent orders) |
| `lowStock` | Snapshot: `{ threshold: 5, count, variants[] }` where `variants` is up to `limit` tracked variants with `inventoryCount < threshold`, lowest stock first |

`getDashboardReport` gains `ops` via `Promise.all` alongside existing sections.

Invalid dates or out-of-range `limit` → `400` with the existing Admin API error shape. Auth unchanged (admin API key middleware on `/api/admin/v1`).

## v1 MCP tools (bermooda-mcp)

| Tool | Admin API |
| --- | --- |
| `get_overview_kpis` | `GET /reports/overview` |
| `get_sales_over_time` | `GET /reports/sales-over-time` |
| `get_top_products` | `GET /reports/sales-by-product` |
| `get_sales_by_category` | `GET /reports/sales-by-category` |
| `get_ops_metrics` | `GET /reports/ops` |
| `get_dashboard_report` | `GET /reports/dashboard` |

Implementation pattern (match existing tools):

1. Add `AdminClient` methods in `src/client.js`.
2. Add `registerReportingTools` in `src/tools/reporting.js`.
3. Wire from `src/tools/index.js` / `src/server.js`.
4. Use Zod `inputSchema` for optional `startDate`, `endDate`, `limit`, `locale`.
5. Wrap with `runTool`.

Update MCP README, `docs/agent-integration.md`, and `.cursor/skills/bermooda-agent/SKILL.md` tool tables.

## Phase 2 (design only — not in v1 implementation)

Sibling report routes and MCP tools. Dashboard composer stays sales + ops until Phase 2 ships; then add these sections only if needed (default: leave them as separate tools/routes).

### Customers — `GET /api/admin/v1/reports/customers`

| Metric | Meaning |
| --- | --- |
| `newCustomers` | Customers with `createdAt` in range |
| `returningCustomers` | Distinct customers with ≥2 paid orders all-time who also ordered in range |
| `ordersByNewVsReturning` | Paid order counts + revenue split for the range |
| `topCustomers` | Top N by paid revenue in range (`limit`) |

MCP: `get_customer_metrics`.

### Inventory — `GET /api/admin/v1/reports/inventory`

Snapshot-oriented aggregates (CRUD remains on existing inventory tools/API):

| Metric | Meaning |
| --- | --- |
| `lowStock` | Variants below threshold (default 5), with sku/title/count/location summary |
| `outOfStock` | Tracked variants at 0 |
| `stockValueCents` | Sum of `inventoryCount * priceCents` for tracked variants |
| `byLocation` | Counts / value rolled up by inventory location |

MCP: `get_inventory_metrics`.

### Exports — `GET /api/admin/v1/reports/exports`

Aggregation over scheduled-export / export-run data (not CSV download):

| Metric | Meaning |
| --- | --- |
| `schedules` | Count by export type / schedule |
| `recentRuns` | Last N runs (status, type, createdAt, error summary) |
| `failureRate` | Failed vs total runs in range |

MCP: `get_export_metrics`. Run-now / download stay on existing export Admin API.

## Testing

**bermooda**

- Unit tests for `getOpsMetrics`: range filtering for abandoned/recent; low stock ignores date range; `limit` caps lists.
- Extend `getDashboardReport` test to assert `ops` is present.
- Route loaders remain thin; follow existing Admin API test patterns if present.

**bermooda-mcp**

- Client method coverage for each new path.
- Tool registration / happy-path tests matching inventory/webhook suites.

## Docs & rollout

**Docs (v1)**

- `docs/api.md` — document all report paths.
- `docs/openapi.yaml` — add missing reports paths (dashboard today is undocumented in OpenAPI).
- Agent/MCP docs and skill as above.

**Rollout order**

1. Core: `getOpsMetrics`; extend `getDashboardReport`.
2. Admin API: split routes + extended dashboard (additive `ops`).
3. bermooda-mcp: client + hybrid tools + README.
4. Docs / OpenAPI / agent skill.
5. Phase 2: separate implementation plan later.

## Out of scope (v1)

- New API key scopes (`reports:read`)
- Chart libraries or Admin UI redesign
- Migrating admin home off `loadAdminDashboardData`
- Implementing Phase 2 customer/inventory/export reporters
- CLI analytics commands
- Direct DB access from MCP

## Success criteria

- An agent with a valid Admin API key can answer “How are sales this month?”, “Top products?”, “Sales by category?”, and “Any ops issues (abandoned / low stock / recent orders)?” via MCP without scraping Admin UI.
- Existing `GET /reports/dashboard` consumers keep working; response only gains `ops`.
- Focused MCP tools each hit one Admin API route (no client-side re-aggregation of ops from list endpoints).
