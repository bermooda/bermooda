// app/core/plugins/index.server.js
// Full plugin loader implementation for bermooda.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import queue from '#/libs/queue.server';
import { emit, isHookAbort, off, on } from '#/core/events/index.server';
import {
  registerProvider as registerPaymentProvider,
  unregisterProvider as unregisterPaymentProvider,
} from '#/core/payments/index.server';
import {
  getDefaultProviderId as getDefaultSearchProviderId,
  registerProvider as registerSearchProvider,
  setDefaultProvider as setDefaultSearchProvider,
  unregisterProvider as unregisterSearchProvider,
} from '#/core/search/index.server';
import {
  get as settingsGet,
  set as settingsSet,
} from '#/core/settings/index.server';
import {
  registerProvider as registerShippingProvider,
  unregisterProvider as unregisterShippingProvider,
} from '#/core/shipping/index.server';
import {
  registerProvider as registerTaxProvider,
  unregisterProvider as unregisterTaxProvider,
} from '#/core/tax/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function getValidProviderTypes() {
  return ['payment', 'shipping', 'tax', 'search'];
}

// ---------------------------------------------------------------------------
// Registry — in-memory store of loaded plugins and their handlers
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PluginManifest
 * @property {string} id
 * @property {string} name
 * @property {string} version
 * @property {string} [description]
 * @property {Object} [hooks]
 * @property {Object} [providers]
 * @property {Object} [blocks]
 * @property {string} [adminRoutes]
 * @property {string} [storefrontRoutes]
 */

/**
 * @typedef {{ type: string, id: string, previousDefaultId?: string | null }} WiredProvider
 */

/** @type {Map<string, { manifest: PluginManifest, handlers: Map<string, Function>, providers: WiredProvider[], isEnabled: boolean }>} */
const registry = new Map();

// ---------------------------------------------------------------------------
// definePlugin — validates a plugin manifest
// ---------------------------------------------------------------------------

/**
 * Validates a plugin manifest and returns it.
 * Throws if any required field is missing or invalid.
 *
 * @param {PluginManifest} manifest
 * @returns {PluginManifest}
 */
export function definePlugin(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Plugin manifest must be an object');
  }

  const required = ['id', 'name', 'version'];
  for (const field of required) {
    const value = manifest[field];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Plugin manifest missing required field: "${field}"`);
    }
  }

  if (manifest.providers) {
    defineProviders(manifest.providers);
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// defineHooks — validates and returns a hooks map
// ---------------------------------------------------------------------------

/**
 * Returns a validated hooks object.
 * Values must be functions.
 *
 * @param {Record<string, Function>} hookMap
 * @returns {Record<string, Function>}
 */
export function defineHooks(hookMap) {
  if (!hookMap || typeof hookMap !== 'object') {
    throw new Error('hookMap must be an object');
  }

  for (const [event, handler] of Object.entries(hookMap)) {
    if (typeof handler !== 'function') {
      throw new Error(
        `Hook "${event}" must be a function, got ${typeof handler}`
      );
    }
  }

  return hookMap;
}

// ---------------------------------------------------------------------------
// defineProvider — returns a typed provider spec
// ---------------------------------------------------------------------------

/**
 * Returns a typed provider spec.
 *
 * @param {'payment' | 'shipping' | 'tax'} type
 * @param {Object} spec
 * @returns {{ type: string } & Object}
 */
export function defineProvider(type, spec) {
  const validProviderTypes = getValidProviderTypes();
  if (!validProviderTypes.includes(type)) {
    throw new Error(
      `Invalid provider type "${type}". Must be one of: ${validProviderTypes.join(', ')}`
    );
  }

  if (!spec || typeof spec !== 'object') {
    throw new Error('Provider spec must be an object');
  }

  return { type, ...spec };
}

// ---------------------------------------------------------------------------
// defineProviders — validates and returns a provider map
// ---------------------------------------------------------------------------

/**
 * Returns a validated providers object.
 * Values must be provider specs created with `defineProvider()`.
 *
 * @param {Record<string, { type: string } & Object>} providerMap
 * @returns {Record<string, { type: string } & Object>}
 */
export function defineProviders(providerMap) {
  if (!providerMap || typeof providerMap !== 'object') {
    throw new Error('providerMap must be an object');
  }

  const validProviderTypes = getValidProviderTypes();

  for (const [providerId, spec] of Object.entries(providerMap)) {
    if (!spec || typeof spec !== 'object') {
      throw new Error(`Provider "${providerId}" must be an object`);
    }
    if (!validProviderTypes.includes(spec.type)) {
      throw new Error(
        `Provider "${providerId}" has invalid type "${spec.type}". Must be one of: ${validProviderTypes.join(', ')}`
      );
    }
  }

  return providerMap;
}

// ---------------------------------------------------------------------------
// Plugin context factory
// ---------------------------------------------------------------------------

/**
 * Builds the plugin ctx object for a given pluginId.
 *
 * @param {string} pluginId
 * @returns {Object}
 */
function buildCtx(pluginId) {
  const pluginLogger = logger.child({ plugin: pluginId });

  // Settings — delegates to the real settings service (P3-6).
  const settings = {
    get: (key) => settingsGet(key),
    set: (key, value) => settingsSet(key, value),
  };

  // PluginData — namespaced by pluginId.
  const plugin = {
    get: async (key) => {
      const row = await prisma.pluginData.findUnique({
        where: { pluginId_key: { pluginId, key } },
      });
      if (!row) return null;
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    },
    set: async (key, value) => {
      const serialized = JSON.stringify(value);
      await prisma.pluginData.upsert({
        where: { pluginId_key: { pluginId, key } },
        create: { pluginId, key, value: serialized },
        update: { value: serialized },
      });
    },
    delete: async (key) => {
      await prisma.pluginData.delete({
        where: { pluginId_key: { pluginId, key } },
      });
    },
  };

  // Queue — exposes LiteQuu job creation to plugins.
  const pluginQueue = {
    add: (jobName, data) => {
      const job = queue.createJob(jobName);
      job.add(data);
      pluginLogger.info({ jobName }, 'Plugin queued job');
    },
    enqueue: (jobName, data) => {
      pluginQueue.add(jobName, data);
    },
  };

  // i18n stub — real translation wired in P3-7.
  const t = (key) => key;

  return {
    db: prisma,
    settings,
    plugin,
    logger: pluginLogger,
    queue: pluginQueue,
    emit,
    t,
  };
}

function registerProvidersForPlugin(entry) {
  const providerMap = entry.manifest.providers;
  if (!providerMap) return;

  for (const [providerId, spec] of Object.entries(
    defineProviders(providerMap)
  )) {
    const { type, ...providerSpec } = spec;

    switch (type) {
      case 'payment':
        registerPaymentProvider(providerId, providerSpec);
        entry.providers.push({ type, id: providerId });
        break;
      case 'shipping':
        registerShippingProvider(providerId, providerSpec);
        entry.providers.push({ type, id: providerId });
        break;
      case 'tax':
        registerTaxProvider(providerId, providerSpec);
        entry.providers.push({ type, id: providerId });
        break;
      case 'search': {
        const previousDefaultId = providerSpec.isDefault
          ? getDefaultSearchProviderId()
          : null;

        registerSearchProvider(providerId, providerSpec.provider, {
          isDefault: providerSpec.isDefault,
        });
        entry.providers.push({
          type,
          id: providerId,
          previousDefaultId,
        });
        break;
      }
      default:
        throw new Error(`Unsupported provider type "${type}"`);
    }
  }
}

function unregisterProvidersForPlugin(entry) {
  for (const provider of [...entry.providers].reverse()) {
    switch (provider.type) {
      case 'payment':
        unregisterPaymentProvider(provider.id);
        break;
      case 'shipping':
        unregisterShippingProvider(provider.id);
        break;
      case 'tax':
        unregisterTaxProvider(provider.id);
        break;
      case 'search':
        unregisterSearchProvider(provider.id);
        if (
          provider.previousDefaultId &&
          provider.previousDefaultId !== provider.id
        ) {
          setDefaultSearchProvider(provider.previousDefaultId);
        }
        break;
      default:
        break;
    }
  }

  entry.providers = [];
}

// ---------------------------------------------------------------------------
// enable / disable
// ---------------------------------------------------------------------------

/**
 * Enables a plugin by:
 * 1. Persisting `plugin.{pluginId}.enabled = "true"` in Settings.
 * 2. Registering any hooks declared in the manifest.
 * 3. Calling `onEnable(ctx)` if present.
 *
 * @param {string} pluginId
 */
export async function enable(pluginId) {
  const entry = registry.get(pluginId);
  if (!entry) throw new Error(`Plugin "${pluginId}" is not registered`);
  if (entry.isEnabled) return;

  const { manifest } = entry;
  const settingKey = `plugin.${pluginId}.enabled`;

  await settingsSet(settingKey, true);
  entry.isEnabled = true;

  // Register hooks from the manifest.
  if (manifest.hooks) {
    for (const [event, handler] of Object.entries(manifest.hooks)) {
      if (typeof handler !== 'function') continue;

      const wrapped = event.startsWith('before.')
        ? async (payload) => {
            try {
              return await handler(payload);
            } catch (err) {
              if (isHookAbort(err) && !err.pluginId) {
                err.pluginId = pluginId;
              }
              throw err;
            }
          }
        : handler;

      on(event, wrapped);
      entry.handlers.set(event, wrapped);
    }
  }

  registerProvidersForPlugin(entry);

  const ctx = buildCtx(pluginId);

  if (typeof manifest.onEnable === 'function') {
    await manifest.onEnable(ctx);
  }

  logger.info({ pluginId }, 'Plugin enabled');
}

/**
 * Disables a plugin by:
 * 1. Persisting `plugin.{pluginId}.enabled = "false"` in Settings.
 * 2. Calling `onDisable(ctx)` if present.
 * 3. Removing all hook handlers the plugin registered via `off()`.
 *
 * @param {string} pluginId
 */
export async function disable(pluginId) {
  const entry = registry.get(pluginId);
  if (!entry) {
    throw new Error(`Plugin "${pluginId}" is not registered`);
  }

  const { manifest } = entry;
  const settingKey = `plugin.${pluginId}.enabled`;

  await settingsSet(settingKey, false);

  const ctx = buildCtx(pluginId);

  if (typeof manifest.onDisable === 'function') {
    await manifest.onDisable(ctx);
  }

  unregisterProvidersForPlugin(entry);

  // Deregister all hooks this plugin registered.
  for (const [event, handler] of entry.handlers) {
    off(event, handler);
  }
  entry.handlers.clear();
  entry.isEnabled = false;

  logger.info({ pluginId }, 'Plugin disabled');
}

// ---------------------------------------------------------------------------
// register — add a validated manifest to the registry
// ---------------------------------------------------------------------------

/**
 * Register a plugin manifest into the in-memory registry.
 * The manifest must have been created via `definePlugin()`.
 *
 * @param {PluginManifest} manifest
 */
export function register(manifest) {
  const validated = definePlugin(manifest);
  registry.set(validated.id, {
    manifest: validated,
    handlers: new Map(),
    providers: [],
    isEnabled: false,
  });
}

// ---------------------------------------------------------------------------
// Discovery + slot blocks
// ---------------------------------------------------------------------------

const pluginModules = import.meta.glob('#/plugins/*/index.server.js', {
  eager: true,
});

/**
 * Register all bundled plugins from app/plugins/*.
 */
export function discoverPlugins() {
  for (const mod of Object.values(pluginModules)) {
    const manifest = mod.pluginManifest ?? mod.default;
    if (manifest?.id) {
      register(manifest);
    }
  }
}

/**
 * Enable plugins persisted in settings (called during async bootstrap).
 */
export async function enablePersistedPlugins() {
  const enabledRaw = await settingsGet('enabledPlugins');
  const enabled = Array.isArray(enabledRaw) ? enabledRaw : [];
  for (const pluginId of enabled) {
    if (!registry.has(pluginId)) continue;
    try {
      await enable(pluginId);
    } catch (err) {
      logger.warn({ err, pluginId }, 'Failed to enable plugin at startup');
    }
  }
}

/**
 * Return admin and storefront slot blocks contributed by enabled plugins.
 *
 * @param {string} slotName
 * @returns {Promise<Array<{ pluginId: string, component: unknown }>>}
 */
export async function getPluginBlocksForSlot(slotName) {
  const pluginOrderRaw = await settingsGet('pluginOrder');
  const pluginOrder = Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [];
  const enabledRaw = await settingsGet('enabledPlugins');
  const enabled = new Set(Array.isArray(enabledRaw) ? enabledRaw : []);

  const orderedIds =
    pluginOrder.length > 0
      ? pluginOrder
      : Array.from(registry.keys()).filter((id) => enabled.has(id));

  const blocks = [];
  for (const pluginId of orderedIds) {
    if (!enabled.has(pluginId)) continue;
    const entry = registry.get(pluginId);
    const component = entry?.manifest?.blocks?.[slotName];
    if (component) {
      blocks.push({ pluginId, component });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// loadPlugins — stable export
// ---------------------------------------------------------------------------

/**
 * Returns the current plugin registry.
 * Phase 5 will implement real plugin discovery from app/plugins/*.
 *
 * @returns {{ plugins: PluginManifest[], hooks: Record<string, Function[]> }}
 */
export function loadPlugins() {
  const plugins = Array.from(registry.values()).map((e) => e.manifest);

  // Aggregate hooks from all registered plugins (only active/registered handlers).
  const hooks = {};
  for (const { handlers } of registry.values()) {
    for (const [event, handler] of handlers) {
      if (!hooks[event]) hooks[event] = [];
      hooks[event].push(handler);
    }
  }

  return { plugins, hooks };
}

// ---------------------------------------------------------------------------
// Plugin route modules
// ---------------------------------------------------------------------------

const adminRouteModules = import.meta.glob(
  '#/plugins/*/admin/routes.server.js',
  {
    eager: true,
  }
);

/** @type {Map<string, Array<{ path: string, loader?: Function, Component: Function }>>} */
const adminRoutesByPlugin = new Map();

for (const [modulePath, mod] of Object.entries(adminRouteModules)) {
  const match = modulePath.match(
    /\/plugins\/([^/]+)\/admin\/routes\.server\.js$/
  );
  if (!match) continue;
  const pluginId = match[1];
  const routes = mod.routes ?? mod.default;
  if (Array.isArray(routes)) {
    adminRoutesByPlugin.set(pluginId, routes);
  }
}

const storefrontRouteModules = import.meta.glob(
  '#/plugins/*/storefront/routes.server.js',
  {
    eager: true,
  }
);

/** @type {Map<string, Array<{ path: string, loader?: Function, Component: Function }>>} */
const storefrontRoutesByPlugin = new Map();

for (const [modulePath, mod] of Object.entries(storefrontRouteModules)) {
  const match = modulePath.match(
    /\/plugins\/([^/]+)\/storefront\/routes\.server\.js$/
  );
  if (!match) continue;
  const pluginId = match[1];
  const routes = mod.routes ?? mod.default;
  if (Array.isArray(routes)) {
    storefrontRoutesByPlugin.set(pluginId, routes);
  }
}

function normalizePluginRoutePath(path) {
  return String(path ?? '')
    .replace(/^\/+|\/+$/g, '')
    .split('?')[0];
}

function resolvePluginRouteDescriptor(routesByPlugin, pluginId, path) {
  const routes = routesByPlugin.get(pluginId);
  if (!routes?.length) return null;

  const normalized = normalizePluginRoutePath(path);

  for (const route of routes) {
    const routePath = normalizePluginRoutePath(route.path);
    if (routePath === normalized) {
      return route;
    }
  }

  if (!normalized && routes[0]) {
    return routes[0];
  }

  return null;
}

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
 * Deprecated alias for admin route resolution.
 *
 * @param {string} pluginId
 * @param {string} path
 * @returns {{ path: string, loader?: Function, Component: Function } | null}
 */
export function resolvePluginRoute(pluginId, path) {
  return resolvePluginAdminRoute(pluginId, path);
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

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export {
  deny,
  emitBefore,
  HookAbortError,
  isHookAbort,
} from '#/core/events/index.server';

export { registry as _registry, buildCtx as _buildCtx };
