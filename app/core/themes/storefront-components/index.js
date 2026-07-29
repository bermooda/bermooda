// Client-safe storefront theme component registry.
// Discovers themes at build time via import.meta.glob; routes select by themeId from loader data.

import { mergeExtensionPackage } from '#/core/extensions/package-meta';

const themeModules = import.meta.glob('#/themes/*/index.js', { eager: true });
const themePackages = import.meta.glob('#/themes/*/package.json', {
  eager: true,
  import: 'default',
});

/** @type {Record<string, object>} theme id → merged manifest */
const THEMES = {};

for (const [modPath, mod] of Object.entries(themeModules)) {
  const folderMatch = modPath.match(/\/themes\/([^/]+)\//);
  if (!folderMatch) continue;
  const folder = folderMatch[1];

  const pkgEntry = Object.entries(themePackages).find(([pkgPath]) =>
    pkgPath.includes(`/themes/${folder}/`)
  );
  if (!pkgEntry) continue;
  const pkg = pkgEntry[1];

  try {
    const runtime = /** @type {{ default?: object }} */ (mod).default ?? {};
    const manifest = mergeExtensionPackage(pkg, runtime);
    THEMES[manifest.id] = manifest;
    // Also index by slug for legacy-friendly lookup.
    if (manifest.slug) {
      THEMES[manifest.slug] = manifest;
    }
  } catch {
    // Malformed theme package — skip.
  }
}

/**
 * Resolve a storefront page component by name and optional theme id.
 *
 * @param {string} name
 * @param {string} [themeId]
 * @returns {unknown | null}
 */
export function getStorefrontComponent(name, themeId) {
  if (themeId) {
    const manifest = THEMES[themeId];
    if (manifest) {
      return manifest.components?.[name] ?? null;
    }
  }

  // Fall back to the first registered theme when no themeId is supplied or
  // the requested id is not present.
  const firstManifest = Object.values(THEMES)[0];
  if (!firstManifest) return null;
  return firstManifest.components?.[name] ?? null;
}

/**
 * Registers a storefront theme manifest for client-side component lookup.
 * Called by the server-side registerTheme to keep client registry in sync.
 *
 * @param {object} manifest
 * @returns {void}
 */
export function registerStorefrontTheme(manifest) {
  THEMES[manifest.id] = manifest;
  if (manifest.slug) {
    THEMES[manifest.slug] = manifest;
  }
}
