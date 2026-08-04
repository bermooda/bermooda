// Client-safe storefront theme component registry.
// Discovers themes at build time via import.meta.glob; routes select by themeId from loader data.

import {
  buildMergedThemeManifest,
  indexThemeManifest,
} from '#/core/themes/discover-shared';

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
    const runtime =
      /** @type {Record<string, unknown>} */ (
        /** @type {{ default?: object }} */ (mod).default
      ) ?? {};
    const manifest = buildMergedThemeManifest(pkg, runtime);
    indexThemeManifest(
      THEMES,
      /** @type {{ id: string, slug?: string }} */ (manifest)
    );
  } catch {
    // Malformed theme package — skip silently (no logger in the browser).
  }
}

/**
 * Resolve a storefront page component by name and theme id.
 * Returns null when the theme is unknown or the component is missing —
 * callers must pass a real themeId from loader data (no silent fallback).
 *
 * @param {string} name
 * @param {string} [themeId]
 * @returns {unknown | null}
 */
export function getStorefrontComponent(name, themeId) {
  if (!themeId) return null;
  const manifest = THEMES[themeId];
  if (!manifest) return null;
  return manifest.components?.[name] ?? null;
}

/**
 * Registers a storefront theme manifest for client-side component lookup.
 * Indexes by package id and slug. Called by server-side `registerTheme`
 * to keep the client registry in sync.
 *
 * @param {{ id: string, slug?: string }} manifest
 * @returns {void}
 */
export function registerStorefrontTheme(manifest) {
  indexThemeManifest(THEMES, manifest);
}
