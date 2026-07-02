// Client-safe storefront theme component registry.
// Bundles all theme manifests at build time; routes select by themeId from loader data.

import defaultThemeManifest from '#/themes/default/manifest';

/** @type {Record<string, typeof defaultThemeManifest>} */
const THEMES = {
  [defaultThemeManifest.id]: defaultThemeManifest,
};

/**
 * Resolve a storefront page component by name and optional theme id.
 *
 * @param {string} name
 * @param {string} [themeId]
 */
export function getStorefrontComponent(name, themeId = 'default') {
  const manifest = THEMES[themeId] ?? THEMES.default ?? defaultThemeManifest;
  return (
    manifest.components[name] ?? defaultThemeManifest.components[name] ?? null
  );
}

export function registerStorefrontTheme(manifest) {
  THEMES[manifest.id] = manifest;
}

export { THEMES as storefrontThemes };
