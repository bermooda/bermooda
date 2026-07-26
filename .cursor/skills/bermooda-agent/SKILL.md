---
name: bermooda-agent
description: How agents (Cursor, Claude) operate on a bermooda shop via MCP and Admin API. Use when configuring MCP, bootstrapping a shop after install, or automating catalog/settings.
---

# bermooda agent integration

## Preferred surface

Use **@bermooda/mcp** (stdio by default) against a running shop. Do not invent shell flags for catalog ops.

| Need              | Tool                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth check        | `ping`, `get_setup_status`                                                                                                                                                                                |
| Configure shop    | `setup_shop` (or `get_settings` / `update_settings`)                                                                                                                                                      |
| Catalog           | `list_*` / `upsert_product` / category tools / `import_products_csv`                                                                                                                                      |
| Orders            | `list_orders`, `get_order`, `update_order_status`                                                                                                                                                         |
| Themes / plugins  | `list_themes`, `activate_theme`, `list_plugins`, `update_plugins`                                                                                                                                         |
| Media / inventory | `upload_media`, `list_inventory_locations`, `set_inventory_level`                                                                                                                                         |
| Webhooks          | `list/create/update/delete_webhook_subscription`                                                                                                                                                          |
| Analytics / KPIs  | `get_dashboard_report`, `get_overview_kpis`, `get_sales_over_time`, `get_top_products`, `get_sales_by_category`, `get_ops_metrics`, `get_customer_metrics`, `get_inventory_metrics`, `get_export_metrics` |

Destructive ops require `confirm=true`. Prefer `dryRun=true` on `setup_shop` / CSV import first.

## Bootstrap after install

1. `bermooda install` (CLI) seeds admin + prints bootstrap `berm_` key; writes `.bermooda/bootstrap-api-key`
2. `bermooda mcp init` → writes `.cursor/mcp.json` with `BERMOODA_URL` + `BERMOODA_API_KEY`
3. Agent uses MCP tools (e.g. `setup_shop`) — no Admin UI required

Env: `BERMOODA_URL` (shop origin), `BERMOODA_API_KEY` (`berm_…`).

## Contract

MCP is a thin HTTP client over `/api/admin/v1`. Domain logic stays in the shop (`app/core/*`). See `docs/agent-integration.md` and `docs/api.md` in the bermooda app repo.
