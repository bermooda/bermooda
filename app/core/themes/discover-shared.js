// Client-safe shared helpers for theme discovery merge + registry indexing.
// Used by both server discoverThemes and the storefront-components eager glob.

import { mergeExtensionPackage } from '#/core/extensions/package-meta';

/**
 * Merges package.json identity with a theme runtime export.
 *
 * @param {unknown} pkg
 * @param {Record<string, unknown>} [runtime]
 * @returns {Record<string, unknown>}
 */
export function buildMergedThemeManifest(pkg, runtime = {}) {
  return mergeExtensionPackage(pkg, runtime);
}

/**
 * Indexes a theme manifest under both package id and slug keys.
 *
 * @param {Record<string, object>} registry
 * @param {{ id: string, slug?: string }} manifest
 * @returns {void}
 */
export function indexThemeManifest(registry, manifest) {
  registry[manifest.id] = manifest;
  if (manifest.slug) {
    registry[manifest.slug] = manifest;
  }
}
