#!/usr/bin/env node
/**
 * Assert a production build bundled an installed extension's nested deps.
 *
 * Used by the CI build job's "Extension smoke build" step after it copies
 * `scripts/fixtures/extension-smoke/` into `app/themes/extension-smoke/`,
 * runs `npm run build`, and deletes the theme's nested `node_modules` (as the
 * Docker image does). Checks:
 *
 * - `build/server/index.js` has no external import of the theme's deps,
 *   including one the shop root also ships (`ssr.noExternal` inlined them).
 * - Importing `build/server/index.js` succeeds (no `ERR_MODULE_NOT_FOUND`)
 *   and server discovery registers the fixture theme.
 * - The client `storefront-components-*.js` chunk does not bundle `semver`
 *   (engine checks are server-only).
 *
 * Usage:
 *   node scripts/check-extension-smoke-build.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const BUILD_DIR = join(REPO_ROOT, 'build');
const FIXTURE_DIR = join(__dirname, 'fixtures', 'extension-smoke');

const fixturePkg = JSON.parse(
  readFileSync(join(FIXTURE_DIR, 'package.json'), 'utf8')
);
const THEME_ID = fixturePkg.name;
/**
 * The fixture's deps plus `yocto-queue` (imported by `p-limit`). `clsx` is
 * also a shop-root dep (v2), so only `ssr.noExternal` keeps it inlined.
 */
const BUNDLED_DEPS = ['clsx', 'p-limit', 'yocto-queue'];

/** @type {string[]} */
const failures = [];

/**
 * @param {string} dep
 * @returns {RegExp}
 */
function externalImportPattern(dep) {
  const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:from\\s*|import\\s*\\(\\s*)["']${escaped}["']`);
}

function checkServerBundleInlinesDeps() {
  const server = readFileSync(join(BUILD_DIR, 'server', 'index.js'), 'utf8');
  for (const dep of BUNDLED_DEPS) {
    if (externalImportPattern(dep).test(server)) {
      failures.push(
        `build/server/index.js imports "${dep}" as an external; it should be inlined via ssr.noExternal`
      );
    }
  }
}

function checkServerBundleImports() {
  const tmp = mkdtempSync(join(tmpdir(), 'bermooda-smoke-'));
  try {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "await import('./build/server/index.js'); process.exit(0);",
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL ?? 'file:./sqlite.db',
          QUEUE_DATABASE_PATH: join(tmp, 'queue.db'),
          // Payments modules construct SDK clients at import time.
          STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? 'sk_test_smoke',
        },
      }
    );
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.status !== 0) {
      failures.push(
        `importing build/server/index.js exited with ${result.status ?? result.signal}:\n${output.trim()}`
      );
      return;
    }
    if (output.includes('ERR_MODULE_NOT_FOUND')) {
      failures.push(
        `importing build/server/index.js logged ERR_MODULE_NOT_FOUND:\n${output.trim()}`
      );
    }
    const registered = output.split('\n').some((line) => {
      try {
        const entry = JSON.parse(line);
        return entry.msg === 'Theme registered' && entry.themeId === THEME_ID;
      } catch {
        return false;
      }
    });
    if (!registered) {
      failures.push(
        `server discovery did not register ${THEME_ID}:\n${output.trim()}`
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function checkClientChunkHasNoSemver() {
  const assetsDir = join(BUILD_DIR, 'client', 'assets');
  const chunks = readdirSync(assetsDir).filter(
    (name) => name.startsWith('storefront-components-') && name.endsWith('.js')
  );
  if (chunks.length === 0) {
    failures.push(
      'no build/client/assets/storefront-components-*.js chunk found'
    );
    return;
  }
  for (const name of chunks) {
    if (
      readFileSync(join(assetsDir, name), 'utf8').includes(
        'SEMVER_SPEC_VERSION'
      )
    ) {
      failures.push(
        `client chunk ${name} bundles semver (SEMVER_SPEC_VERSION); engine checks must stay server-only`
      );
    }
  }
}

checkServerBundleInlinesDeps();
checkServerBundleImports();
checkClientChunkHasNoSemver();

if (failures.length > 0) {
  console.error('extension-smoke: FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `extension-smoke: ok (${THEME_ID} registered; ${BUNDLED_DEPS.join(', ')} inlined; client chunk has no semver)`
);
