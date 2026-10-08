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
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXTENSION_KIND_DIRS } from '../app/core/extensions/deps.server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

/**
 * Extension folder names under one kind dir. Unlike `listExtensionPackages`,
 * keeps folders without a package.json: Tailwind only needs their files.
 *
 * @param {string} kindDir
 * @returns {string[]}
 */
function listExtensionFolders(kindDir) {
  if (!existsSync(kindDir)) return [];
  return readdirSync(kindDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name);
}

/**
 * Sync theme/plugin trees into the Tailwind scan cache. Each kind's link dir
 * is rebuilt from scratch, so links to removed extensions don't linger.
 *
 * @param {{ log?: (msg: string) => void, repoRoot?: string }} [options]
 * @returns {Record<string, number>} Linked folders per kind (`themes`, `plugins`)
 */
export function syncExtensionTwSources(options = {}) {
  const log = options.log ?? (() => {});
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const cacheDir = join(
    repoRoot,
    'node_modules',
    '.cache',
    'bermooda-tw-sources'
  );

  /** @type {Record<string, number>} */
  const counts = {};
  for (const kind of EXTENSION_KIND_DIRS) {
    const kindDir = join(repoRoot, 'app', kind);
    const linkDir = join(cacheDir, kind);
    // rmSync removes the links themselves, never their targets.
    rmSync(linkDir, { recursive: true, force: true });
    mkdirSync(linkDir, { recursive: true });

    const folders = listExtensionFolders(kindDir);
    for (const folder of folders) {
      symlinkSync(
        relative(linkDir, join(kindDir, folder)),
        join(linkDir, folder)
      );
    }
    counts[kind] = folders.length;
  }

  log(
    `extension-tw-sources: linked ${counts.themes} theme(s), ${counts.plugins} plugin(s) → ${relative(repoRoot, cacheDir)}`
  );
  return counts;
}

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
