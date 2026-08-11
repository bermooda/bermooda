#!/usr/bin/env bash
# Ensure .env exists for local setup (Prisma needs DATABASE_URL).
# Copies from .env.example when missing; never overwrites an existing .env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  exit 0
fi

if [[ ! -f .env.example ]]; then
  echo "ensure-env: missing .env.example; cannot create .env" >&2
  exit 1
fi

cp .env.example .env
echo "Created .env from .env.example"
