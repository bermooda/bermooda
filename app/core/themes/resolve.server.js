// Server-only active theme preload for storefront loaders.

import { resolveActiveTheme } from '#/core/themes/index.server';

let cachedThemeId = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Resolve and cache the active theme id for the current request cycle.
 * @returns {Promise<string>}
 */
export async function preloadStorefrontTheme() {
  if (cachedThemeId && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedThemeId;
  }

  const theme = await resolveActiveTheme();
  cachedThemeId = theme?.id ?? 'default';
  cachedAt = Date.now();
  return cachedThemeId;
}

export function invalidateThemeCache() {
  cachedThemeId = null;
  cachedAt = 0;
}
