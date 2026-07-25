#!/usr/bin/env node
/**
 * Adapter-aware bootstrap for bermooda-cli install.
 *
 * Invoked from the shop root with env:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_SHOP_NAME
 *   BERMOODA_MINIMAL_SEED=1  — skip demo catalog (server default)
 *   DATABASE_URL / DATABASE_PROVIDER — selects SQLite or PostgreSQL adapter
 *   BERMOODA_URL — optional; printed in MCP config snippet with bootstrap key
 *
 * After seed: creates first admin (if needed), marks setup complete, and prints
 * a one-time bootstrap API key when none exist yet.
 *
 * Usage:
 *   node scripts/cli-bootstrap.mjs
 *   npm run cli:bootstrap
 */

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shopRoot = join(__dirname, '..');
const seedPath = join(shopRoot, 'prisma', 'seed.js');

/**
 * Run prisma/seed.js with strip-types (seed imports generated .ts client).
 * Seed itself is adapter-aware and honors SEED_* / BERMOODA_MINIMAL_SEED.
 */
function runSeed() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', seedPath],
      {
        cwd: shopRoot,
        env: process.env,
        stdio: 'inherit',
      }
    );
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        resolve(130);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

/**
 * Quick preflight: ensure we can resolve adapters before spawning seed.
 * Fails fast with a clear message if deps are missing.
 */
function preflight() {
  const require = createRequire(join(shopRoot, 'package.json'));
  try {
    require.resolve('@prisma/adapter-better-sqlite3');
    require.resolve('@prisma/adapter-pg');
    require.resolve('bcryptjs');
  } catch (err) {
    console.error(
      'cli-bootstrap: missing dependency. Run `npm install` in the shop first.'
    );
    console.error(err.message);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('cli-bootstrap: DATABASE_URL is required');
    process.exit(1);
  }
}

async function main() {
  console.log('bermooda cli-bootstrap…');
  preflight();

  const minimal =
    process.env.BERMOODA_MINIMAL_SEED === '1' ||
    process.env.BERMOODA_MINIMAL_SEED === 'true';
  if (minimal) {
    console.log('Minimal seed mode (demo catalog skipped).');
  }
  if (process.env.SEED_SHOP_NAME) {
    console.log(`Shop name: ${process.env.SEED_SHOP_NAME}`);
  }
  if (process.env.SEED_ADMIN_EMAIL) {
    console.log(`Admin email: ${process.env.SEED_ADMIN_EMAIL}`);
  }

  const code = await runSeed();
  if (code !== 0) {
    process.exit(code);
  }
  console.log('cli-bootstrap complete.');
  console.log(
    'Next: configure MCP with BERMOODA_URL + the bootstrap API key printed above,'
  );
  console.log(
    'or call POST /api/admin/v1/setup/api-key with SETUP_TOKEN when no key exists.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
