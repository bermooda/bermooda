# Agents and bermooda

Short guide for Cursor / Claude agents operating on a shop. Full architecture: [agent-integration.md](./agent-integration.md). Admin contract: [api.md](./api.md).

## Quick path

1. Install with [bermooda-cli](https://github.com/bermooda/bermooda-cli) (`bermooda install`)
2. Run `bermooda mcp init` in the shop (uses bootstrap key / `.env`)
3. Use [bermooda-mcp](https://github.com/bermooda/bermooda-mcp) tools from Cursor or Claude Desktop

## Config

```json
{
  "mcpServers": {
    "bermooda": {
      "command": "npx",
      "args": ["-y", "bermooda-mcp"],
      "env": {
        "BERMOODA_URL": "http://localhost:3000",
        "BERMOODA_API_KEY": "berm_REPLACE_ME"
      }
    }
  }
}
```

Optional hosted transport: `bermooda-mcp` `npm run start:http` (Streamable HTTP) when stdio is not available.

## First agent tasks

- `ping` — verify URL + key
- `setup_shop` with `dryRun=true`, then `confirm=true` — name, currencies, shipping, sample categories/products
- `list_products` / `upsert_product` for catalog work

Do not put ecommerce domain logic in MCP or the CLI — call the Admin API (or MCP tools that wrap it).
