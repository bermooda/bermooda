// app/core/themes/index.server.js
// Theme loader: define, register, and resolve storefront themes.

import cache, { getCachedResult } from '#/utils/cache/index.server';
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { getPluginBlocksForSlot } from '#/core/plugins/index.server';
import { get, set } from '#/core/settings/index.server';
import {
  REQUIRED_COMPONENTS,
  REQUIRED_MANIFEST_FIELDS,
  SLOT_NAMES,
} from '#/core/themes/manifest';
import { registerStorefrontTheme } from '#/core/themes/storefront-components';

export { SLOT_NAMES };

// ---------------------------------------------------------------------------
// In-memory theme registry
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} theme id → validated manifest */
const _registry = new Map();

let cachedThemeId = null;
let cachedAt = 0;
const PRELOAD_CACHE_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// defineTheme
// ---------------------------------------------------------------------------

/**
 * Validates a theme manifest at build time.
 * Throws if required fields or required components are missing.
 *
 * @param {object} manifest
 * @returns {object} the manifest, unchanged
 */
export function defineTheme(manifest) {
  if (manifest === null || typeof manifest !== 'object') {
    throw new TypeError('defineTheme: manifest must be a non-null object');
  }

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field]) {
      throw new Error(
        `defineTheme: manifest is missing required field "${field}"`
      );
    }
  }

  for (const field of ['id', 'name', 'version']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) {
      throw new Error(
        `defineTheme: manifest field "${field}" must be a non-empty string`
      );
    }
  }

  for (const name of REQUIRED_COMPONENTS) {
    if (!(name in manifest.components)) {
      throw new Error(
        `defineTheme: manifest.components is missing required component "${name}"`
      );
    }
  }

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
  const validated = defineTheme(manifest);
  _registry.set(validated.id, validated);
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

  return _registry.get(themeId) ?? null;
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
  cachedThemeId = theme?.id ?? 'default';
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
// Internal exports (for testing)
// ---------------------------------------------------------------------------

export function __resetRegistry() {
  _registry.clear();
  invalidateThemeCache();
}

export { _registry };
