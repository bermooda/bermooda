# CLI design (handoff)

The **@bermooda/cli** design and implementation live in a **standalone repository**:

- **Repo:** https://github.com/bermooda/cli
- **Local (this workspace):** `../cli/`
- **Full design:** [`cli/DESIGN.md`](../../cli/DESIGN.md)
- **Product checklist:** [cli-specs.md](./cli-specs.md)

### Summary

| Item        | Value                                            |
| ----------- | ------------------------------------------------ |
| npm package | `@bermooda/cli`                                  |
| Binary      | `bermooda`                                       |
| Install     | `npm i -g @bermooda/cli@latest`                  |
| Shop source | Downloaded from `bermooda/bermooda` on `install` |

### App-side work still needed

See **PR-A1 / PR-A2** in `cli/DESIGN.md`:

1. Adapter-aware seed / `scripts/cli-bootstrap.mjs` (SQLite + PostgreSQL, `SEED_SHOP_NAME`, minimal seed)
2. README Getting Started pointing at the CLI

Do not put CLI package code under this app monorepo.
