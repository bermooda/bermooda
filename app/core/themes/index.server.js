// app/core/themes/index.server.js
// Theme loader: define, register, and resolve storefront themes.

import { getCachedResult } from '#/utils/cache.server';
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { getPluginBlocksForSlot } from '#/core/plugins/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Well-known slot names available for plugin blocks.
 * @type {string[]}
 */
export const SLOT_NAMES = [
  'home.hero',
  'home.featured',
  'product.afterDescription',
  'product.sidebar',
  'category.top',
  'cart.summary',
  'checkout.afterPayment',
  'account.dashboard',
  'layout.header',
  'layout.footer',
];

/** Required top-level fields in a theme manifest. */
const REQUIRED_FIELDS = ['id', 'name', 'version', 'components'];

/** Required component names that every theme must supply. */
const REQUIRED_COMPONENTS = [
  'Layout',
  'HomePage',
  'ProductPage',
  'CategoryPage',
  'CartPage',
  'CheckoutLayout',
  'NotFoundPage',
];

// ---------------------------------------------------------------------------
// In-memory theme registry
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} theme id → validated manifest */
const _registry = new Map();

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

  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) {
      throw new Error(
        `defineTheme: manifest is missing required field "${field}"`
      );
    }
  }

  // Validate string fields are non-empty
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
  logger.info({ themeId: validated.id }, 'Theme registered');
  return validated;
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

// ---------------------------------------------------------------------------
// getStorefrontComponent
// ---------------------------------------------------------------------------

/**
 * Resolves a component by name from the active theme.
 *
 * @param {string} name - component name (e.g. "Layout")
 * @returns {Promise<unknown|null>} the component value or null
 */
export async function getStorefrontComponent(name) {
  const theme = await resolveActiveTheme();
  if (!theme) return null;
  return theme.components[name] ?? null;
}

// ---------------------------------------------------------------------------
// getSlotBlocks
// ---------------------------------------------------------------------------

/**
 * Returns the ordered list of plugin blocks for a given slot.
 * Reads `Setting.pluginOrder` (TTL-cached) and filters to plugins that
 * contribute to the requested slot. Returns `{ pluginId, component }[]`.
 *
 * Phase 5 will wire in real plugin block resolution; for now returns [].
 *
 * @param {string} _slotName
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

// Exported only for testing — never call in production code.
export function __resetRegistry() {
  _registry.clear();
}

// Admin-only export: exposes all registered themes for the admin UI.
export { _registry };
