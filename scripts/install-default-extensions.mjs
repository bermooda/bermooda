#!/usr/bin/env node
/**
 * Contributor install helper.
 *
 * Copies the default theme and plugins from sibling checkout directories
 * into app/themes/ and app/plugins/. Falls back to `npm pack` / npm tarball
 * install when the sibling directory is absent.
 *
 * Sibling copies exclude `node_modules` (so contributor checkouts stay lean);
 * after copy, this script runs `install-extension-deps` so each extension's
 * own package.json dependencies are installed into that folder's
 * `node_modules` for Vite resolution/bundling. The bermooda CLI performs the
 * same per-extension `npm install` on `theme add` / `plugin add`.
 *
 * Sibling layout (relative to bermooda repo root):
 *   ../theme-default   → app/themes/default/   (slug: default)
 *   ../plugin-meilisearch → app/plugins/meilisearch/
 *   ../plugin-resend   → app/plugins/resend/
 *   ../plugin-sendgrid → app/plugins/sendgrid/ (optional)
 *   ../plugin-aws-ses  → app/plugins/aws-ses/ (optional)
 *
 * After copying, optionally calls cli-set-extensions.mjs to activate the
 * theme and enable the plugins when DATABASE_URL is available.
 *
 * Usage:
 *   node scripts/install-default-extensions.mjs
 *   npm run extensions:install
 */

import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { installAllExtensionDeps } from './install-extension-deps.mjs';
import { syncExtensionTwSources } from './sync-extension-tw-sources.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const APP_DIR = join(REPO_ROOT, 'app');

/** @typedef {{ siblingDir: string, destDir: string, packageId: string }} ExtensionSpec */

/** @type {ExtensionSpec[]} */
const ALWAYS_INSTALL = [
  {
    siblingDir: join(REPO_ROOT, '..', 'theme-default'),
    destDir: join(APP_DIR, 'themes', 'default'),
    packageId: '@bermooda/theme-default',
  },
  {
    siblingDir: join(REPO_ROOT, '..', 'plugin-meilisearch'),
    destDir: join(APP_DIR, 'plugins', 'meilisearch'),
    packageId: '@bermooda/plugin-meilisearch',
  },
  {
    siblingDir: join(REPO_ROOT, '..', 'plugin-resend'),
    destDir: join(APP_DIR, 'plugins', 'resend'),
    packageId: '@bermooda/plugin-resend',
  },
];

/**
 * Optional extensions installed only when the sibling directory is present.
 * These are not activated by default but are needed for tests and local dev.
 *
 * @type {ExtensionSpec[]}
 */
const OPTIONAL_INSTALL = [
  {
    siblingDir: join(REPO_ROOT, '..', 'plugin-sendgrid'),
    destDir: join(APP_DIR, 'plugins', 'sendgrid'),
    packageId: '@bermooda/plugin-sendgrid',
  },
  {
    siblingDir: join(REPO_ROOT, '..', 'plugin-aws-ses'),
    destDir: join(APP_DIR, 'plugins', 'aws-ses'),
    packageId: '@bermooda/plugin-aws-ses',
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
 * Run `npm pack` inside the sibling directory and extract the tarball into
 * the destination directory as a fallback when the sibling is absent.
 *
 * This requires the sibling to be published to npm or use `npm pack`.
 * In practice contributors should always have the sibling checkout; this path
 * is intentionally a last-resort and prints a clear error on failure.
 *
 * @param {ExtensionSpec} spec
 */
function installFromNpm(spec) {
  console.log(
    `extensions:install  ${spec.packageId}  ← npm (sibling not found)`
  );
  try {
    execFileSync('npm', ['install', '--prefix', spec.destDir, spec.packageId], {
      stdio: 'inherit',
      cwd: REPO_ROOT,
    });
  } catch {
    console.error(
      `extensions:install  FAILED to install ${spec.packageId} via npm. ` +
        `Clone the sibling repo at ${spec.siblingDir} or publish the package first.`
    );
    process.exit(1);
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
        BERMOODA_ENABLED_PLUGINS:
          '@bermooda/plugin-meilisearch,@bermooda/plugin-resend',
      },
    });
  } catch {
    console.warn(
      'extensions:install  Could not update settings (DB may not be set up yet). Run `npm run setup` first.'
    );
  }
}

async function main() {
  console.log('extensions:install  Installing default extensions…');

  for (const spec of ALWAYS_INSTALL) {
    const installed = installFromSibling(spec);
    if (!installed) {
      installFromNpm(spec);
    }
  }

  for (const spec of OPTIONAL_INSTALL) {
    installFromSibling(spec);
  }

  console.log(
    'extensions:install  Extensions copied to app/themes and app/plugins.'
  );
  console.log('extensions:install  Installing per-extension npm dependencies…');
  installAllExtensionDeps(APP_DIR, { omitDev: false });
  syncExtensionTwSources({ log: console.log });
  await setExtensionsInDb();
  console.log('extensions:install  Done.');
}

main().catch((err) => {
  console.error('extensions:install failed:', err.message);
  process.exit(1);
});
