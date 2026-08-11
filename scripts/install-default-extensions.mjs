#!/usr/bin/env node
/**
 * Contributor install helper.
 *
 * Copies the default theme from a sibling checkout directory into
 * app/themes/. Falls back to `npm pack` + tarball extract when the sibling
 * directory is absent, placing package contents directly at
 * `app/themes/<slug>/` (same layout as the sibling copy — not nested under
 * `node_modules/<packageId>/`).
 *
 * Does not install plugins — add those with `bermooda plugin add` when needed.
 *
 * Sibling copies exclude `node_modules` (so contributor checkouts stay lean);
 * after copy (or pack+extract), this script runs `install-extension-deps` so
 * the theme's own package.json dependencies are installed into that folder's
 * `node_modules` for Vite resolution/bundling. The bermooda CLI performs the
 * same per-extension `npm install` on `theme add` / `plugin add`.
 *
 * Sibling layout (relative to bermooda repo root):
 *   ../theme-default → app/themes/default/   (always; npm fallback)
 *
 * After copying, optionally calls cli-set-extensions.mjs to activate the
 * default theme when DATABASE_URL is available.
 *
 * Usage:
 *   node scripts/install-default-extensions.mjs
 *   npm run extensions:install
 *   (also invoked by `npm run setup`)
 */

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installAllExtensionDeps } from './install-extension-deps.mjs';
import { syncExtensionTwSources } from './sync-extension-tw-sources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const APP_DIR = join(REPO_ROOT, 'app');

/** @typedef {{ siblingDir: string, destDir: string, packageId: string }} ExtensionSpec */

/** @type {ExtensionSpec[]} */
const DEFAULT_THEME = [
  {
    siblingDir: join(REPO_ROOT, '..', 'theme-default'),
    destDir: join(APP_DIR, 'themes', 'default'),
    packageId: '@bermooda/theme-default',
  },
];

/**
 * Copy a sibling directory to the destination, excluding node_modules and
 * common VCS/tooling artifacts.
 *
 * @param {string} src
 * @param {string} dest
 */
function copyExtension(src, dest) {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (srcPath) => {
      const base = srcPath.split('/').pop() ?? '';
      return (
        base !== 'node_modules' &&
        base !== '.git' &&
        base !== '.DS_Store' &&
        !base.endsWith('.log')
      );
    },
  });
}

/**
 * Attempt to install an extension from its sibling checkout.
 * Returns true when successful, false when the sibling directory is absent.
 *
 * @param {ExtensionSpec} spec
 * @returns {boolean}
 */
function installFromSibling(spec) {
  if (!existsSync(spec.siblingDir)) {
    return false;
  }
  console.log(`extensions:install  ${spec.packageId}  ← ${spec.siblingDir}`);
  copyExtension(spec.siblingDir, spec.destDir);
  return true;
}

/**
 * Fallback when the sibling checkout is absent: `npm pack` the published
 * package, extract the tarball, and copy contents into `spec.destDir` so
 * `index.js` / `package.json` land at the slug root (same layout as
 * {@link copyExtension}).
 *
 * @param {ExtensionSpec} spec
 */
function installFromNpm(spec) {
  console.log(
    `extensions:install  ${spec.packageId}  ← npm pack (sibling not found)`
  );
  const tmp = mkdtempSync(join(tmpdir(), 'bermooda-ext-'));
  try {
    const packed = execFileSync(
      'npm',
      ['pack', spec.packageId, '--pack-destination', tmp],
      {
        encoding: 'utf8',
        cwd: REPO_ROOT,
      }
    )
      .trim()
      .split('\n')
      .pop();
    const tarball = join(tmp, packed);
    mkdirSync(spec.destDir, { recursive: true });
    execFileSync('tar', ['-xzf', tarball, '-C', tmp], { stdio: 'inherit' });
    // npm pack extracts to package/
    const extracted = join(tmp, 'package');
    if (
      !existsSync(join(extracted, 'index.js')) &&
      !existsSync(join(extracted, 'package.json'))
    ) {
      throw new Error(`Unexpected pack layout for ${spec.packageId}`);
    }
    copyExtension(extracted, spec.destDir);
  } catch (err) {
    console.error(
      `extensions:install  FAILED to install ${spec.packageId} via npm pack. ` +
        `Clone the sibling repo at ${spec.siblingDir} or publish the package first.`,
      err
    );
    process.exit(1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function setExtensionsInDb() {
  if (!process.env.DATABASE_URL) {
    console.log(
      'extensions:install  DATABASE_URL not set — skipping settings update.'
    );
    return;
  }
  const setScript = join(REPO_ROOT, 'scripts', 'cli-set-extensions.mjs');
  try {
    execFileSync(process.execPath, ['--experimental-strip-types', setScript], {
      stdio: 'inherit',
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        BERMOODA_ACTIVE_THEME: '@bermooda/theme-default',
      },
    });
  } catch {
    console.warn(
      'extensions:install  Could not update settings (DB may not be set up yet). Run `npm run setup` first.'
    );
  }
}

async function main() {
  console.log('extensions:install  Installing default theme…');

  for (const spec of DEFAULT_THEME) {
    const installed = installFromSibling(spec);
    if (!installed) {
      installFromNpm(spec);
    }
  }

  console.log('extensions:install  Default theme copied to app/themes.');
  console.log('extensions:install  Installing theme npm dependencies…');
  installAllExtensionDeps(APP_DIR, { omitDev: false });
  syncExtensionTwSources({ log: console.log });
  await setExtensionsInDb();
  console.log('extensions:install  Done.');
}

main().catch((err) => {
  console.error('extensions:install failed:', err.message);
  process.exit(1);
});
