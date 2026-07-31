#!/usr/bin/env node
/**
 * Install npm dependencies declared by installed themes and plugins.
 *
 * Runs `npm install --prefix <extension-dir>` for every
 * `app/themes/<slug>` / `app/plugins/<slug>` package that lists runtime
 * dependencies. The bermooda CLI does this on theme/plugin add; this script
 * covers contributor `extensions:install` and Docker/`prebuild` so nested
 * `node_modules` exist before Vite resolves and bundles imports.
 *
 * Usage:
 *   node scripts/install-extension-deps.mjs
 *   node scripts/install-extension-deps.mjs --omit=dev
 */

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listExtensionPackages,
  listExtensionsNeedingInstall,
} from '../app/core/extensions/deps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const APP_DIR = join(REPO_ROOT, 'app');

/**
 * @param {string[]} argv
 * @returns {{ omitDev: boolean }}
 */
function parseArgs(argv) {
  return {
    omitDev: argv.includes('--omit=dev') || argv.includes('--production'),
  };
}

/**
 * Install runtime dependencies for one extension directory.
 *
 * @param {string} dir
 * @param {{ omitDev: boolean }} options
 */
export function installDepsForExtension(dir, options) {
  const args = ['install', '--prefix', dir, '--legacy-peer-deps'];
  if (options.omitDev) {
    args.push('--omit=dev');
  }
  execFileSync('npm', args, {
    stdio: 'inherit',
    cwd: REPO_ROOT,
  });
}

/**
 * Install deps for every extension under app/ that declares runtime deps.
 *
 * @param {string} [appDir]
 * @param {{ omitDev?: boolean, log?: (msg: string) => void }} [options]
 * @returns {{ installed: number, skipped: number }}
 */
export function installAllExtensionDeps(appDir = APP_DIR, options = {}) {
  const omitDev = options.omitDev ?? false;
  const log = options.log ?? ((msg) => console.log(msg));
  const all = listExtensionPackages(appDir);
  const needing = listExtensionsNeedingInstall(appDir);
  const skipped = all.length - needing.length;

  if (all.length === 0) {
    log('extension-deps: no themes/plugins installed — nothing to install.');
    return { installed: 0, skipped: 0 };
  }

  if (needing.length === 0) {
    log(
      `extension-deps: ${all.length} extension(s) present; none declare runtime dependencies.`
    );
    return { installed: 0, skipped };
  }

  for (const ext of needing) {
    const depCount =
      Object.keys(ext.packageJson.dependencies ?? {}).length +
      Object.keys(ext.packageJson.optionalDependencies ?? {}).length;
    log(
      `extension-deps: npm install --prefix app/${ext.kind}/${ext.slug} (${depCount} runtime dep(s))`
    );
    installDepsForExtension(ext.dir, { omitDev });
  }

  return { installed: needing.length, skipped };
}

function main() {
  const { omitDev } = parseArgs(process.argv.slice(2));
  const { installed, skipped } = installAllExtensionDeps(APP_DIR, { omitDev });
  console.log(
    `extension-deps: done (installed=${installed}, skipped=${skipped}).`
  );
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    main();
  } catch (err) {
    console.error(
      'extension-deps: failed:',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}
