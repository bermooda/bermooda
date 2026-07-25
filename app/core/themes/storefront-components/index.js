// Client-safe storefront theme component registry.
// Bundles all theme manifests at build time; routes select by themeId from loader data.

import { mergeExtensionPackage } from '#/core/extensions/package-meta';

import defaultRuntime from '#/themes/default/index';
import defaultPkg from '#/themes/default/package.json';

const defaultThemeManifest = mergeExtensionPackage(defaultPkg, defaultRuntime);

/** @type {Record<string, typeof defaultThemeManifest>} */
const THEMES = {
  [defaultThemeManifest.id]: defaultThemeManifest,
};

/**
 * Resolve a storefront page component by name and optional theme id.
 *
 * @param {string} name
 * @param {string} [themeId]
 * @returns {unknown | null}
 */
export function getStorefrontComponent(
  name,
  themeId = defaultThemeManifest.id
) {
  const resolvedId = themeId === 'default' ? defaultThemeManifest.id : themeId;
  const manifest =
    THEMES[resolvedId] ??
    THEMES[defaultThemeManifest.id] ??
    defaultThemeManifest;
  return (
    manifest.components[name] ?? defaultThemeManifest.components[name] ?? null
  );
}

/**
 * Registers a storefront theme manifest for client-side component lookup.
 * @param {typeof defaultThemeManifest} manifest
 * @returns {void}
 */
export function registerStorefrontTheme(manifest) {
  THEMES[manifest.id] = manifest;
}
