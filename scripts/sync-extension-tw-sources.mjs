#!/usr/bin/env node
/**
 * Symlink installed themes/plugins into node_modules/.cache so Tailwind v4 can
 * scan their class names.
 *
 * Tailwind skips .gitignore paths by default, and app/themes/* + app/plugins/*
 * are gitignored install targets. `@source` of those dirs is also skipped in
 * current Tailwind releases. Pointing `@source` at a path under node_modules
 * marks it external (same as scanning a published UI package), and symlinks
 * keep sources live for `vite`/`dev` without copying.
 *
 * Usage:
 *   node scripts/sync-extension-tw-sources.mjs
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  lstatSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CACHE_DIR = join(
  REPO_ROOT,
  'node_modules',
  '.cache',
  'bermooda-tw-sources'
);

/**
 * @param {string} kind - `themes` or `plugins`
 * @returns {string[]}
 */
function listExtensionSlugs(kind) {
  const dir = join(REPO_ROOT, 'app', kind);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
}

/**
 * Replace dest with a relative symlink to target.
 *
 * @param {string} targetAbs
 * @param {string} destAbs
 */
function ensureSymlink(targetAbs, destAbs) {
  mkdirSync(dirname(destAbs), { recursive: true });
  try {
    lstatSync(destAbs);
    rmSync(destAbs, { recursive: true, force: true });
  } catch {
    // missing — nothing to remove
  }
  const rel = relative(dirname(destAbs), targetAbs);
  symlinkSync(rel, destAbs);
}

/**
 * Sync theme/plugin trees into the Tailwind scan cache.
 *
 * @param {{ log?: (msg: string) => void }} [options]
 * @returns {{ themes: number, plugins: number }}
 */
export function syncExtensionTwSources(options = {}) {
  const log = options.log ?? (() => {});
  mkdirSync(CACHE_DIR, { recursive: true });

  let themes = 0;
  for (const slug of listExtensionSlugs('themes')) {
    const target = join(REPO_ROOT, 'app', 'themes', slug);
    ensureSymlink(target, join(CACHE_DIR, 'themes', slug));
    themes += 1;
  }

  let plugins = 0;
  for (const slug of listExtensionSlugs('plugins')) {
    const target = join(REPO_ROOT, 'app', 'plugins', slug);
    ensureSymlink(target, join(CACHE_DIR, 'plugins', slug));
    plugins += 1;
  }

  log(
    `extension-tw-sources: linked ${themes} theme(s), ${plugins} plugin(s) → ${relative(REPO_ROOT, CACHE_DIR)}`
  );
  return { themes, plugins };
}

export const EXTENSION_TW_SOURCES_DIR = CACHE_DIR;

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    syncExtensionTwSources({ log: console.log });
  } catch (err) {
    console.error(
      'extension-tw-sources: failed:',
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}
