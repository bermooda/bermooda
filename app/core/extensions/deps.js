/**
 * Helpers for theme/plugin npm dependency discovery.
 *
 * Extension packages under `app/themes/<slug>/` and `app/plugins/<slug>/` may
 * declare their own `dependencies`. The shop build resolves those from each
 * extension's nested `node_modules` (Node walk-up from the importing file).
 * Server builds must also list them in Vite `ssr.noExternal` so they are
 * bundled at build time — otherwise Vite externalizes `node_modules` and the
 * runtime resolves from `build/server/`, which only sees the shop root
 * `node_modules`.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Relative dirs under `app/` that hold installable extensions. */
export const EXTENSION_KIND_DIRS = Object.freeze(['themes', 'plugins']);

/**
 * @typedef {Object} ExtensionPackageJson
 * @property {string} [name]
 * @property {Record<string, string>} [dependencies]
 * @property {Record<string, string>} [optionalDependencies]
 * @property {Record<string, string>} [peerDependencies]
 * @property {Record<string, string>} [devDependencies]
 */

/**
 * @typedef {Object} ExtensionPackageInfo
 * @property {string} kind - `themes` or `plugins`
 * @property {string} slug - Folder name under the kind dir
 * @property {string} dir - Absolute path to the extension folder
 * @property {string} packageJsonPath
 * @property {ExtensionPackageJson} packageJson
 */

/**
 * Read and parse a package.json file.
 *
 * @param {string} packageJsonPath
 * @returns {ExtensionPackageJson | null}
 */
export function readPackageJsonFile(packageJsonPath) {
  try {
    const raw = readFileSync(packageJsonPath, 'utf8');
    return /** @type {ExtensionPackageJson} */ (JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Runtime dependency names from an extension package.json.
 * Excludes peerDependencies (expected from the shop root) and devDependencies.
 *
 * @param {ExtensionPackageJson | null | undefined} pkg
 * @returns {string[]}
 */
export function runtimeDependencyNamesFromPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return [];
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);
  return [...names].sort();
}

/**
 * Whether an extension package declares any installable runtime dependencies.
 *
 * @param {ExtensionPackageJson | null | undefined} pkg
 * @returns {boolean}
 */
export function hasRuntimeDependencies(pkg) {
  return runtimeDependencyNamesFromPackage(pkg).length > 0;
}

/**
 * List installed extension packages under `app/themes` and `app/plugins`.
 *
 * Skips placeholder dirs without a readable package.json (e.g. empty gitkeep
 * trees). Does not recurse into nested packages.
 *
 * @param {string} appDir Absolute path to the shop `app/` directory
 * @returns {ExtensionPackageInfo[]}
 */
export function listExtensionPackages(appDir) {
  /** @type {ExtensionPackageInfo[]} */
  const results = [];

  for (const kind of EXTENSION_KIND_DIRS) {
    const kindDir = join(appDir, kind);
    if (!existsSync(kindDir)) continue;

    let entries;
    try {
      entries = readdirSync(kindDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name;
      if (slug.startsWith('.')) continue;

      const dir = join(kindDir, slug);
      const packageJsonPath = join(dir, 'package.json');
      if (!existsSync(packageJsonPath)) continue;

      const packageJson = readPackageJsonFile(packageJsonPath);
      if (!packageJson) continue;

      results.push({ kind, slug, dir, packageJsonPath, packageJson });
    }
  }

  return results;
}

/**
 * Collect unique runtime dependency package names across all extensions.
 *
 * Used by Vite `ssr.noExternal` so extension-only deps are bundled into the
 * server build instead of being left as unresolved root externals.
 *
 * @param {string} appDir Absolute path to the shop `app/` directory
 * @returns {string[]}
 */
export function collectExtensionRuntimeDependencyNames(appDir) {
  const names = new Set();
  for (const ext of listExtensionPackages(appDir)) {
    for (const name of runtimeDependencyNamesFromPackage(ext.packageJson)) {
      names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Extension directories that need `npm install --prefix` (have runtime deps).
 *
 * @param {string} appDir Absolute path to the shop `app/` directory
 * @returns {ExtensionPackageInfo[]}
 */
export function listExtensionsNeedingInstall(appDir) {
  return listExtensionPackages(appDir).filter((ext) =>
    hasRuntimeDependencies(ext.packageJson)
  );
}
