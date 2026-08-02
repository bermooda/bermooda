// app/core/themes/index.server.js
// Theme loader: define, register, and resolve storefront themes.

import cache, {
  getCachedResult,
  invalidateCachePrefix,
} from '#/utils/cache/index.server';
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { checkExtensionEngine, getAppVersion } from '#/core/extensions/engine';
import {
  SLUG_PATTERN,
  assertSlugMatchesFolder,
  mergeExtensionPackage,
} from '#/core/extensions/package-meta';
import { getPluginBlocksForSlot } from '#/core/plugins/index.server';
import { get, set } from '#/core/settings/index.server';
import { defineTheme } from '#/core/themes/define';
import { REQUIRED_MANIFEST_FIELDS, SLOT_NAMES } from '#/core/themes/manifest';
import { registerStorefrontTheme } from '#/core/themes/storefront-components';

export { SLOT_NAMES, defineTheme };

// ---------------------------------------------------------------------------
// In-memory theme registry
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} theme id → validated manifest */
const _registry = new Map();
/** @type {Map<string, string>} theme slug → theme id */
const _slugIndex = new Map();

let cachedThemeId = null;
let cachedAt = 0;
const PRELOAD_CACHE_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// validateRegisteredTheme
// ---------------------------------------------------------------------------

/**
 * Validates a fully merged theme manifest before registration.
 *
 * @param {Record<string, unknown>} manifest
 * @returns {object} the manifest, unchanged
 */
function validateRegisteredTheme(manifest) {
  if (manifest === null || typeof manifest !== 'object') {
    throw new TypeError('registerTheme: manifest must be a non-null object');
  }

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field]) {
      throw new Error(
        `registerTheme: manifest is missing required field "${field}"`
      );
    }
  }

  for (const field of ['id', 'title', 'version', 'slug']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
      throw new Error(
        `registerTheme: manifest field "${field}" must be a non-empty string`
      );
    }
  }

  if (!SLUG_PATTERN.test(manifest.slug)) {
    throw new Error(
      `registerTheme: manifest slug must be lowercase hyphenated, got "${manifest.slug}"`
    );
  }

  defineTheme(manifest);
  return manifest;
}

// ---------------------------------------------------------------------------
// registerTheme
// ---------------------------------------------------------------------------

/**
 * Validates and registers a theme manifest into the in-memory registry.
 * Typically called at application startup for bundled themes.
 *
 * @param {object} manifest
 * @returns {object} the validated manifest
 */
export function registerTheme(manifest) {
  const validated = validateRegisteredTheme(manifest);
  _registry.set(validated.id, validated);
  _slugIndex.set(validated.slug, validated.id);
  registerStorefrontTheme(validated);
  logger.info({ themeId: validated.id }, 'Theme registered');
  return validated;
}

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

/**
 * Returns all registered theme manifests.
 *
 * @returns {object[]}
 */
export function listRegisteredThemes() {
  return Array.from(_registry.values());
}

/**
 * Returns a registered theme manifest by id, or null.
 *
 * @param {string} themeId
 * @returns {object|null}
 */
export function getRegisteredTheme(themeId) {
  return _registry.get(themeId) ?? null;
}

/**
 * Returns a registered theme manifest by slug, or null.
 *
 * @param {string} slug
 * @returns {object|null}
 */
export function getRegisteredThemeBySlug(slug) {
  const themeId = _slugIndex.get(slug);
  return themeId ? getRegisteredTheme(themeId) : null;
}

// ---------------------------------------------------------------------------
// resolveActiveTheme
// ---------------------------------------------------------------------------

/**
 * Resolves the active theme manifest from the in-memory registry.
 * The active theme ID is read from `Setting.activeTheme` (TTL-cached, 5 min).
 *
 * @returns {Promise<object|null>} the active theme manifest, or null
 */
export async function resolveActiveTheme() {
  const themeId = await getCachedResult(
    'theme:active',
    async () => {
      const row = await prisma.setting.findUnique({
        where: { key: 'activeTheme' },
      });
      return row?.value ?? null;
    },
    5 * 60 * 1000
  );

  if (!themeId) return null;

  // Primary lookup by package id; fall back to slug index for legacy stored values.
  const byId = _registry.get(themeId);
  if (byId) return byId;

  const resolvedId = _slugIndex.get(themeId);
  return resolvedId ? (_registry.get(resolvedId) ?? null) : null;
}

/**
 * Resolve and cache the active theme id for the current process.
 * @returns {Promise<string>}
 */
export async function preloadStorefrontTheme() {
  if (cachedThemeId && Date.now() - cachedAt < PRELOAD_CACHE_TTL_MS) {
    return cachedThemeId;
  }

  const theme = await resolveActiveTheme();
  cachedThemeId = theme?.id ?? '@bermooda/theme-default';
  cachedAt = Date.now();
  return cachedThemeId;
}

export function invalidateThemeCache() {
  cachedThemeId = null;
  cachedAt = 0;
}

// ---------------------------------------------------------------------------
// Admin theme settings
// ---------------------------------------------------------------------------

/**
 * Loads persisted values for a theme's manifest-driven settings.
 *
 * @param {object|null} manifest
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loadThemeSettings(manifest) {
  if (!manifest?.settings?.length) return {};

  const entries = await Promise.all(
    manifest.settings.map(async (setting) => {
      const value = await get(`theme.${manifest.id}.${setting.key}`);
      return [setting.key, value ?? setting.default ?? ''];
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Normalizes a single theme setting value from form data.
 *
 * @param {object} setting
 * @param {FormDataEntryValue|null} raw
 * @returns {unknown}
 */
export function parseThemeSettingValue(setting, raw) {
  if (setting.type === 'toggle') {
    return raw === 'on';
  }

  return raw ?? '';
}

/**
 * Persists theme settings from an admin form submission.
 *
 * @param {string} themeId
 * @param {object} manifest
 * @param {FormData} formData
 * @returns {Promise<void>}
 */
export async function saveThemeSettings(themeId, manifest, formData) {
  if (!manifest?.settings?.length) {
    throw new Error('No settings for theme');
  }

  await Promise.all(
    manifest.settings.map(async (setting) => {
      const value = parseThemeSettingValue(setting, formData.get(setting.key));
      await set(`theme.${themeId}.${setting.key}`, value);
    })
  );
}

/**
 * Normalize a theme setting value from a JSON object payload.
 *
 * @param {object} setting
 * @param {unknown} raw
 * @returns {unknown}
 */
export function parseThemeSettingJsonValue(setting, raw) {
  if (setting.type === 'toggle') {
    return Boolean(raw);
  }
  if (raw === undefined || raw === null) {
    return setting.default ?? '';
  }
  return raw;
}

/**
 * Persists theme settings from a JSON object (Admin API).
 *
 * @param {string} themeId
 * @param {object} manifest
 * @param {Record<string, unknown>} values
 * @returns {Promise<void>}
 */
export async function saveThemeSettingsValues(themeId, manifest, values = {}) {
  if (!manifest?.settings?.length) {
    throw Object.assign(new Error('No settings for theme'), {
      code: 'THEME_SETTINGS_INVALID',
      status: 400,
    });
  }

  await Promise.all(
    manifest.settings.map(async (setting) => {
      const value = Object.prototype.hasOwnProperty.call(values, setting.key)
        ? parseThemeSettingJsonValue(setting, values[setting.key])
        : (setting.default ?? (setting.type === 'toggle' ? false : ''));
      await set(`theme.${themeId}.${setting.key}`, value);
    })
  );
}

/**
 * Activates a theme by id and busts resolution caches.
 *
 * @param {string} themeId
 * @returns {Promise<void>}
 */
export async function setActiveTheme(themeId) {
  if (!themeId) {
    throw new Error('Missing themeId');
  }

  await set('activeTheme', themeId);
  cache.delete('theme:active');
  invalidateThemeCache();
  // Message catalogs embed the active theme — bust so the next request
  // merges catalogs for the newly selected theme.
  invalidateCachePrefix('i18n:');
}

// ---------------------------------------------------------------------------
// getSlotBlocks
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of plugin blocks for a given slot.
 *
 * @param {string} slotName
 * @returns {Promise<Array<{ pluginId: string, component: unknown }>>}
 */
export async function getSlotBlocks(slotName) {
  return getPluginBlocksForSlot(slotName);
}

/**
 * Returns a slot-keyed map of plugin blocks for the requested slot names.
 *
 * @param {string[]} slotNames
 * @returns {Promise<Record<string, Array<{ pluginId: string, component: unknown }>>>}
 */
export async function getSlotBlocksMap(slotNames = []) {
  const entries = await Promise.all(
    slotNames.map(async (slotName) => [slotName, await getSlotBlocks(slotName)])
  );

  return Object.fromEntries(entries);
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const themeModules = import.meta.glob('#/themes/*/index.js', { eager: true });
const themePackages = import.meta.glob('#/themes/*/package.json', {
  eager: true,
  import: 'default',
});

/**
 * Returns the theme folder segment from an import.meta.glob path.
 *
 * @param {string} modulePath
 * @returns {string}
 */
function themeFolderFromPath(modulePath) {
  const match = modulePath.match(/\/themes\/([^/]+)\//);
  if (!match) {
    throw new Error(`Cannot parse theme folder from "${modulePath}"`);
  }
  return match[1];
}

/**
 * Register all installed themes from app/themes/*.
 */
export function discoverThemes() {
  const seenSlugs = new Set();
  const shopVersion = getAppVersion();

  for (const [modPath, mod] of Object.entries(themeModules)) {
    const folder = themeFolderFromPath(modPath);
    const pkgEntry = Object.entries(themePackages).find(([pkgPath]) =>
      pkgPath.includes(`/themes/${folder}/`)
    );
    if (!pkgEntry) {
      throw new Error(`Missing package.json for theme folder "${folder}"`);
    }
    const pkg = pkgEntry[1];

    const engineCheck = checkExtensionEngine({
      shopVersion,
      engine: pkg?.bermooda?.engine,
      kind: 'theme',
      id: pkg?.bermooda?.slug ?? folder,
    });
    if (!engineCheck.ok) {
      logger.error(
        { folder, reason: engineCheck.reason },
        'Skipping incompatible theme'
      );
      continue;
    }

    const runtime = mod.default ?? {};
    const manifest = mergeExtensionPackage(pkg, runtime);
    assertSlugMatchesFolder(manifest.slug, folder, 'theme');

    if (seenSlugs.has(manifest.slug)) {
      throw new Error(`Duplicate theme slug "${manifest.slug}"`);
    }
    seenSlugs.add(manifest.slug);
    registerTheme(manifest);
  }
}

// ---------------------------------------------------------------------------
// Internal exports (for testing)
// ---------------------------------------------------------------------------

export function __resetRegistry() {
  _registry.clear();
  _slugIndex.clear();
  invalidateThemeCache();
}

export { _registry, _slugIndex };
