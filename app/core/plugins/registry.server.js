// app/core/plugins/registry.server.js
// In-memory plugin registry, define* helpers, discovery, and route resolution.

import logger from '#/utils/logger.server';
import { pairExtensionModules } from '#/core/extensions/discovery';
import {
  checkExtensionEngine,
  getAppVersion,
} from '#/core/extensions/engine.server';
import {
  SLUG_PATTERN,
  assertSlugMatchesFolder,
  mergeExtensionPackage,
} from '#/core/extensions/package-meta';
import {
  definePlugin,
  defineHooks,
  defineProvider,
  defineProviders,
} from '#/core/plugins/define.server';
import { REQUIRED_MANIFEST_FIELDS } from '#/core/plugins/manifest';
import {
  buildPluginRouteRegistry,
  resolvePluginRouteDescriptor,
} from '#/core/plugins/routes';

export { definePlugin, defineHooks, defineProvider, defineProviders };

/**
 * @typedef {Object} PluginManifest
 * @property {string} id
 * @property {string} title
 * @property {string} version
 * @property {string} slug
 * @property {string} [description]
 * @property {Object} [hooks]
 * @property {Object} [providers]
 * @property {Object} [blocks]
 */

/**
 * @typedef {{ type: string, id: string, previousDefaultId?: string | null }} WiredProvider
 */

/** @type {Map<string, { manifest: PluginManifest, handlers: Map<string, Function>, providers: WiredProvider[], isEnabled: boolean }>} */
export const registry = new Map();
/** @type {Map<string, string>} */
export const slugIndex = new Map();

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

/**
 * Returns all registered plugin manifests.
 *
 * @returns {PluginManifest[]}
 */
export function listRegisteredPlugins() {
  return Array.from(registry.values()).map((entry) => entry.manifest);
}

/**
 * Returns a registered plugin manifest by id, or null.
 *
 * @param {string} pluginId
 * @returns {PluginManifest|null}
 */
export function getRegisteredPlugin(pluginId) {
  return registry.get(pluginId)?.manifest ?? null;
}

/**
 * Returns a registered plugin manifest by slug, or null.
 *
 * @param {string} slug
 * @returns {PluginManifest|null}
 */
export function getRegisteredPluginBySlug(slug) {
  const pluginId = slugIndex.get(slug);
  return pluginId ? (registry.get(pluginId)?.manifest ?? null) : null;
}

/**
 * Validates a fully merged plugin manifest and returns it.
 *
 * @param {PluginManifest} manifest
 * @returns {PluginManifest}
 */
export function validateRegisteredPlugin(manifest) {
  definePlugin(/** @type {Record<string, unknown>} */ (manifest));
  const manifestRecord = /** @type {Record<string, unknown>} */ (manifest);

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    const value = manifestRecord[field];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Plugin manifest missing required field: "${field}"`);
    }
  }

  if (!SLUG_PATTERN.test(manifest.slug)) {
    throw new Error(`Plugin manifest has invalid slug "${manifest.slug}"`);
  }

  return manifest;
}

/**
 * Register a plugin manifest into the in-memory registry.
 * The manifest must include merged package identity metadata.
 *
 * @param {PluginManifest} manifest
 * @returns {void}
 */
export function register(manifest) {
  const validated = validateRegisteredPlugin(manifest);
  registry.set(validated.id, {
    manifest: validated,
    handlers: new Map(),
    providers: [],
    isEnabled: false,
  });
  slugIndex.set(validated.slug, validated.id);
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const pluginModules = import.meta.glob('#/plugins/*/index.server.js', {
  eager: true,
});
const pluginPackages = import.meta.glob('#/plugins/*/package.json', {
  eager: true,
  import: 'default',
});

/**
 * Discover and register plugins from glob-like module/package maps.
 * Malformed packages (merge, slug/folder assert, manifest validation) and
 * incompatible engines are logged and skipped; duplicate slugs and missing
 * package.json still throw.
 *
 * @param {Record<string, { pluginManifest?: object, default?: object }>} modules
 * @param {Record<string, object>} packages
 * @returns {void}
 */
export function __discoverPluginsFrom(modules, packages) {
  const seenSlugs = new Set();
  const shopVersion = getAppVersion();

  for (const { folder, mod, pkg } of pairExtensionModules(
    modules,
    packages,
    'plugins'
  )) {
    if (!pkg) {
      throw new Error(`Missing package.json for plugin folder "${folder}"`);
    }

    const engineCheck = checkExtensionEngine({
      shopVersion,
      engine: pkg?.bermooda?.engine,
      kind: 'plugin',
      id: pkg?.bermooda?.slug ?? folder,
    });
    if (!engineCheck.ok) {
      logger.error(
        { folder, reason: engineCheck.reason },
        'Skipping incompatible plugin'
      );
      continue;
    }

    /** @type {PluginManifest} */
    let manifest;
    try {
      const runtime = mod.pluginManifest ?? mod.default ?? {};
      manifest = /** @type {PluginManifest} */ (
        mergeExtensionPackage(pkg, runtime)
      );
      assertSlugMatchesFolder(manifest.slug, folder, 'plugin');
    } catch (err) {
      logger.error({ folder, err }, 'Skipping malformed plugin');
      continue;
    }

    // Duplicate detection stays outside the soft-skip path so it always aborts.
    if (seenSlugs.has(manifest.slug)) {
      throw new Error(`Duplicate plugin slug "${manifest.slug}"`);
    }

    try {
      register(manifest);
      seenSlugs.add(manifest.slug);
    } catch (err) {
      logger.error({ folder, err }, 'Skipping malformed plugin');
    }
  }
}

/**
 * Register all bundled plugins from app/plugins/*.
 *
 * @returns {void}
 */
export function discoverPlugins() {
  __discoverPluginsFrom(pluginModules, pluginPackages);
}

// ---------------------------------------------------------------------------
// Plugin route modules
// ---------------------------------------------------------------------------

const adminRoutesByPlugin = buildPluginRouteRegistry(
  import.meta.glob('#/plugins/*/admin/routes/index.server.js', {
    eager: true,
  }),
  /\/plugins\/([^/]+)\/admin\/routes\/index\.server\.js$/
);

const storefrontRoutesByPlugin = buildPluginRouteRegistry(
  import.meta.glob('#/plugins/*/storefront/routes/index.server.js', {
    eager: true,
  }),
  /\/plugins\/([^/]+)\/storefront\/routes\/index\.server\.js$/
);

/**
 * Resolves an admin route descriptor for a plugin path.
 *
 * @param {string} pluginId
 * @param {string} path - splat path without leading slash
 * @returns {{ path: string, loader?: Function, Component: Function } | null}
 */
export function resolvePluginAdminRoute(pluginId, path) {
  return resolvePluginRouteDescriptor(adminRoutesByPlugin, pluginId, path);
}

/**
 * Resolves a storefront route descriptor for a plugin path.
 *
 * @param {string} pluginId
 * @param {string} path - splat path without leading slash
 * @returns {{ path: string, loader?: Function, Component: Function } | null}
 */
export function resolvePluginStorefrontRoute(pluginId, path) {
  return resolvePluginRouteDescriptor(storefrontRoutesByPlugin, pluginId, path);
}

/**
 * Clears the in-memory plugin registry (tests only).
 *
 * @returns {void}
 */
export function __resetRegistry() {
  registry.clear();
  slugIndex.clear();
}
