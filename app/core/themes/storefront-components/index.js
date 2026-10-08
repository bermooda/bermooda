// Client-safe storefront theme component registry; routes select by themeId
// from loader data.
//
// Server: `registerTheme` (theme discovery) fills the registry at startup, so
// SSR resolves components synchronously and this module globs nothing there.
// Browser: each theme's `index.js` is its own lazy chunk, loaded the first time
// a route asks for that theme, so shoppers only download the active theme.

import { use } from 'react';

import { pairExtensionModules } from '#/core/extensions/discovery';
import {
  buildMergedThemeManifest,
  indexThemeManifest,
} from '#/core/themes/discover-shared';

/** @type {Record<string, () => Promise<{ default?: unknown }>>} */
const lazyThemeModules = import.meta.env.SSR
  ? {}
  : import.meta.glob('#/themes/*/index.js');
/** @type {Record<string, unknown>} */
const themePackages = import.meta.env.SSR
  ? {}
  : import.meta.glob('#/themes/*/package.json', {
      eager: true,
      import: 'default',
    });

/** @type {Record<string, object>} theme id or slug → merged manifest */
const THEMES = {};

/**
 * theme id or slug → `{ load, pkg }` for browser lazy-loading.
 *
 * @type {Map<string, { load: () => Promise<{ default?: unknown }>, pkg: unknown }>}
 */
const LOADERS = new Map();

/**
 * Index lazy theme loaders by package id and slug. Folders without a
 * package.json are skipped. Exported for tests; the module calls it once with
 * the build-time globs.
 *
 * @param {Record<string, () => Promise<{ default?: unknown }>>} modules
 * @param {Record<string, unknown>} packages
 * @returns {void}
 */
export function __registerLazyThemesFrom(modules, packages) {
  for (const { mod: load, pkg } of pairExtensionModules(
    modules,
    packages,
    'themes'
  )) {
    const identity =
      /** @type {{ name?: unknown, bermooda?: { slug?: unknown } }} */ (
        pkg ?? {}
      );
    const entry = { load, pkg };
    for (const key of [identity.name, identity.bermooda?.slug]) {
      if (typeof key === 'string' && key) LOADERS.set(key, entry);
    }
  }
}

__registerLazyThemesFrom(lazyThemeModules, themePackages);

/** @type {Map<object, Promise<void>>} loader entry → load (one per theme) */
const LOADS = new Map();

/**
 * Load a theme chunk and index its merged manifest. Malformed packages are
 * skipped silently (no logger in the browser), so lookups return null as if
 * the theme were unknown.
 *
 * @param {{ load: () => Promise<{ default?: unknown }>, pkg: unknown }} entry
 * @returns {Promise<void>}
 */
function loadTheme(entry) {
  let pending = LOADS.get(entry);
  if (!pending) {
    pending = entry.load().then((mod) => {
      try {
        const runtime =
          /** @type {Record<string, unknown>} */ (mod.default) ?? {};
        indexThemeManifest(
          THEMES,
          /** @type {{ id: string, slug?: string }} */ (
            buildMergedThemeManifest(entry.pkg, runtime)
          )
        );
      } catch {
        // Malformed theme package — leave it unregistered.
      }
    });
    LOADS.set(entry, pending);
  }
  return pending;
}

/**
 * Resolve a storefront page component by name and theme id.
 * Returns null when the theme is unknown or the component is missing —
 * callers must pass a real themeId from loader data (no silent fallback).
 *
 * Call it during render. In the browser, the first lookup for a theme whose
 * chunk hasn't loaded yet suspends (React `use`) until it has.
 *
 * @param {string} name
 * @param {string} [themeId]
 * @returns {unknown | null}
 */
export function getStorefrontComponent(name, themeId) {
  if (!themeId) return null;
  if (!THEMES[themeId]) {
    const entry = LOADERS.get(themeId);
    if (!entry) return null;
    use(loadTheme(entry));
  }
  return THEMES[themeId]?.components?.[name] ?? null;
}

/**
 * Registers a storefront theme manifest for component lookup. Indexes by
 * package id and slug. Called by server-side `registerTheme`.
 *
 * @param {{ id: string, slug?: string }} manifest
 * @returns {void}
 */
export function registerStorefrontTheme(manifest) {
  indexThemeManifest(THEMES, manifest);
}
