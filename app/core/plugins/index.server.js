// app/core/plugins/index.server.js
// Full plugin loader implementation for bermooda.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import queue from '#/libs/queue.server';
import {
  registerProvider as registerAddressValidationProvider,
  unregisterProvider as unregisterAddressValidationProvider,
} from '#/core/address-validation/index.server';
import { emit, isHookAbort, off, on } from '#/core/events/index.server';
import { isBeforeHookEvent } from '#/core/events/names';
import {
  LEGACY_PLUGIN_ID_MAP,
  SLUG_PATTERN,
  assertSlugMatchesFolder,
  mergeExtensionPackage,
  normalizeLegacyIds,
} from '#/core/extensions/package-meta';
import { translate } from '#/core/i18n';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';
import {
  registerProvider as registerPaymentProvider,
  unregisterProvider as unregisterPaymentProvider,
} from '#/core/payments/index.server';
import { REQUIRED_MANIFEST_FIELDS } from '#/core/plugins/manifest';
import {
  buildPluginRouteRegistry,
  resolvePluginRouteDescriptor,
} from '#/core/plugins/routes';
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
// Registry — in-memory store of loaded plugins and their handlers
// ---------------------------------------------------------------------------

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
const registry = new Map();
/** @type {Map<string, string>} */
const slugIndex = new Map();

// ---------------------------------------------------------------------------
// definePlugin — validates plugin runtime configuration
// ---------------------------------------------------------------------------

/**
 * Validates plugin runtime configuration and returns it.
 *
 * @param {Record<string, unknown>} runtime
 * @returns {Record<string, unknown>}
 */
export function definePlugin(runtime) {
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('Plugin manifest must be an object');
  }

  if (runtime.providers) {
    defineProviders(
      /** @type {Record<string, { type: string } & Object>} */ (
        runtime.providers
      )
    );
  }

  return runtime;
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
 * Returns a typed provider spec object.
 *
 * @param {'payment' | 'shipping' | 'tax' | 'search' | 'address_validation'} type
 * @param {Object} spec
 * @returns {{ type: string } & Object}
 */
export function defineProvider(type, spec) {
  if (
    !['payment', 'shipping', 'tax', 'search', 'address_validation'].includes(
      type
    )
  ) {
    throw new Error(
      `Invalid provider type "${type}". Must be one of: payment, shipping, tax, search, address_validation`
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

  for (const [providerId, spec] of Object.entries(providerMap)) {
    if (!spec || typeof spec !== 'object') {
      throw new Error(`Provider "${providerId}" must be an object`);
    }
    if (
      !['payment', 'shipping', 'tax', 'search', 'address_validation'].includes(
        spec.type
      )
    ) {
      throw new Error(
        `Provider "${providerId}" has invalid type "${spec.type}". Must be one of: payment, shipping, tax, search, address_validation`
      );
    }
  }

  return providerMap;
}

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
 * Returns persisted enabled plugin ids.
 *
 * @returns {Promise<string[]>}
 */
export async function getEnabledPluginIds() {
  const enabledRaw = await settingsGet('enabledPlugins');
  const enabled = Array.isArray(enabledRaw) ? enabledRaw : [];
  return normalizeLegacyIds(enabled, LEGACY_PLUGIN_ID_MAP);
}

/**
 * Returns whether a plugin id is in the persisted enabled list.
 *
 * @param {string} pluginId
 * @returns {Promise<boolean>}
 */
export async function isPluginEnabled(pluginId) {
  const enabled = await getEnabledPluginIds();
  return enabled.includes(pluginId);
}

/**
 * Sorts plugin manifests by persisted display order.
 *
 * @param {PluginManifest[]} plugins
 * @param {string[]} pluginOrder
 * @returns {PluginManifest[]}
 */
export function sortPluginsByOrder(plugins, pluginOrder) {
  const order = Array.isArray(pluginOrder) ? pluginOrder : [];

  return [...plugins].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/**
 * Builds a full plugin order list from stored order plus untracked ids.
 *
 * @param {string[]} storedOrder
 * @param {string[]} pluginIds
 * @returns {string[]}
 */
export function buildFullPluginOrder(storedOrder, pluginIds) {
  const order = Array.isArray(storedOrder) ? storedOrder : [];
  const trackedIds = order.filter((id) => pluginIds.includes(id));
  const untrackedIds = pluginIds.filter((id) => !trackedIds.includes(id));
  return [...trackedIds, ...untrackedIds];
}

/**
 * Loads persisted values for a plugin's manifest-driven settings.
 *
 * @param {PluginManifest|null|undefined} manifest
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loadPluginSettings(manifest) {
  if (!manifest?.settings?.length) return {};

  const entries = await Promise.all(
    manifest.settings.map(async (setting) => {
      const value = await settingsGet(`plugin.${manifest.id}.${setting.key}`);
      return [setting.key, value ?? setting.default ?? ''];
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Loads persisted settings for all plugins that declare settings fields.
 *
 * @param {PluginManifest[]} plugins
 * @returns {Promise<Record<string, Record<string, unknown>>>}
 */
export async function loadAllPluginSettings(plugins) {
  const entries = await Promise.all(
    plugins.map(async (manifest) => [
      manifest.id,
      await loadPluginSettings(manifest),
    ])
  );

  return Object.fromEntries(entries);
}

/**
 * Normalizes a single plugin setting value from form data.
 *
 * @param {object} setting
 * @param {FormDataEntryValue|null} raw
 * @returns {unknown}
 */
export function parsePluginSettingValue(setting, raw) {
  if (setting.type === 'toggle') {
    return raw === 'on';
  }

  return raw ?? '';
}

/**
 * Persists plugin settings from an admin form submission.
 *
 * @param {string} pluginId
 * @param {PluginManifest} manifest
 * @param {FormData} formData
 * @returns {Promise<void>}
 */
export async function savePluginSettings(pluginId, manifest, formData) {
  if (!manifest?.settings?.length) {
    throw new Error('No settings for plugin');
  }

  await Promise.all(
    manifest.settings.map(async (setting) => {
      const value = parsePluginSettingValue(setting, formData.get(setting.key));
      await settingsSet(`plugin.${pluginId}.${setting.key}`, value);
    })
  );
}

/**
 * Persists enabled state and wires or unwires the plugin live.
 *
 * @param {string} pluginId
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
export async function setPluginEnabledState(pluginId, enabled) {
  if (!registry.has(pluginId)) {
    throw new Error('Plugin not found');
  }

  const previousEnabled = await getEnabledPluginIds();
  const nextEnabled = [...previousEnabled];

  if (enabled) {
    if (!nextEnabled.includes(pluginId)) nextEnabled.push(pluginId);
  } else {
    const idx = nextEnabled.indexOf(pluginId);
    if (idx !== -1) nextEnabled.splice(idx, 1);
  }

  await settingsSet('enabledPlugins', nextEnabled);

  try {
    if (enabled) {
      await enable(pluginId);
    } else {
      await disable(pluginId);
    }
  } catch (err) {
    await settingsSet('enabledPlugins', previousEnabled);
    throw err;
  }
}

/**
 * Persist the full plugin display order.
 *
 * @param {string[]} orderedIds
 * @returns {Promise<string[]>}
 */
export async function setPluginOrder(orderedIds) {
  const pluginIds = listRegisteredPlugins().map((manifest) => manifest.id);
  const pluginIdSet = new Set(pluginIds);

  if (
    orderedIds.length !== pluginIds.length ||
    orderedIds.some((id) => !pluginIdSet.has(id))
  ) {
    throw new Error('Invalid plugin order');
  }

  const fullOrder = buildFullPluginOrder(orderedIds, pluginIds);
  await settingsSet('pluginOrder', fullOrder);
  return fullOrder;
}

// ---------------------------------------------------------------------------
// Plugin context factory
// ---------------------------------------------------------------------------

/**
 * Builds the plugin ctx object for a given pluginId.
 *
 * @param {string} pluginId
 * @param {{ messages?: Record<string, unknown> }} [options]
 * @returns {Object}
 */
function buildCtx(pluginId, options = {}) {
  const { messages = {} } = options;
  const pluginLogger = logger.child({ plugin: pluginId });

  const settings = {
    get: (key) => settingsGet(key),
    set: (key, value) => settingsSet(key, value),
  };

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

  const t = (key, params) => translate(key, params, messages);

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

async function buildLifecycleCtx(pluginId) {
  const { loadMessages } = await import('#/core/i18n/index.server');
  const messages = await loadMessages(DEFAULT_LOCALE);
  return buildCtx(pluginId, { messages });
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
      case 'address_validation':
        registerAddressValidationProvider(providerId, providerSpec);
        entry.providers.push({ type, id: providerId });
        break;
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
      case 'address_validation':
        unregisterAddressValidationProvider(provider.id);
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
 * Enables a plugin by registering hooks/providers and calling onEnable.
 *
 * @param {string} pluginId
 */
export async function enable(pluginId) {
  const entry = registry.get(pluginId);
  if (!entry) throw new Error(`Plugin "${pluginId}" is not registered`);
  if (entry.isEnabled) return;

  const { manifest } = entry;
  entry.isEnabled = true;

  if (manifest.hooks) {
    for (const [event, handler] of Object.entries(manifest.hooks)) {
      if (typeof handler !== 'function') continue;

      const wrapped = isBeforeHookEvent(event)
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

  const ctx = await buildLifecycleCtx(pluginId);

  if (typeof manifest.onEnable === 'function') {
    await manifest.onEnable(ctx);
  }

  logger.info({ pluginId }, 'Plugin enabled');
}

/**
 * Disables a plugin by calling onDisable and removing hooks/providers.
 *
 * @param {string} pluginId
 */
export async function disable(pluginId) {
  const entry = registry.get(pluginId);
  if (!entry) {
    throw new Error(`Plugin "${pluginId}" is not registered`);
  }

  const { manifest } = entry;
  const ctx = await buildLifecycleCtx(pluginId);

  if (typeof manifest.onDisable === 'function') {
    await manifest.onDisable(ctx);
  }

  unregisterProvidersForPlugin(entry);

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
 * Validates a fully merged plugin manifest and returns it.
 *
 * @param {PluginManifest} manifest
 * @returns {PluginManifest}
 */
function validateRegisteredPlugin(manifest) {
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
// Discovery + slot blocks
// ---------------------------------------------------------------------------

const pluginModules = import.meta.glob('#/plugins/*/index.server.js', {
  eager: true,
});
const pluginPackages = import.meta.glob('#/plugins/*/package.json', {
  eager: true,
  import: 'default',
});

/**
 * Returns the plugin folder segment from an import.meta.glob path.
 *
 * @param {string} modulePath
 * @returns {string}
 */
function pluginFolderFromPath(modulePath) {
  const match = modulePath.match(/\/plugins\/([^/]+)\//);
  if (!match) {
    throw new Error(`Cannot parse plugin folder from "${modulePath}"`);
  }
  return match[1];
}

/**
 * Register all bundled plugins from app/plugins/*.
 */
export function discoverPlugins() {
  const seenSlugs = new Set();

  for (const [modPath, mod] of Object.entries(pluginModules)) {
    const folder = pluginFolderFromPath(modPath);
    const pkgEntry = Object.entries(pluginPackages).find(([pkgPath]) =>
      pkgPath.includes(`/plugins/${folder}/`)
    );
    if (!pkgEntry) {
      throw new Error(`Missing package.json for plugin folder "${folder}"`);
    }
    const pkg = pkgEntry[1];
    const runtime = mod.pluginManifest ?? mod.default ?? {};
    const manifest = /** @type {PluginManifest} */ (
      mergeExtensionPackage(pkg, runtime)
    );
    assertSlugMatchesFolder(manifest.slug, folder, 'plugin');
    if (seenSlugs.has(manifest.slug)) {
      throw new Error(`Duplicate plugin slug "${manifest.slug}"`);
    }
    seenSlugs.add(manifest.slug);
    register(manifest);
  }
}

/**
 * Enable plugins persisted in settings (called during async bootstrap).
 */
export async function enablePersistedPlugins() {
  const enabled = await getEnabledPluginIds();
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
  const [pluginOrderRaw, enabled] = await Promise.all([
    settingsGet('pluginOrder'),
    getEnabledPluginIds(),
  ]);
  const pluginOrder = Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [];
  const enabledSet = new Set(enabled);

  const orderedIds =
    pluginOrder.length > 0
      ? pluginOrder
      : listRegisteredPlugins()
          .map((manifest) => manifest.id)
          .filter((id) => enabledSet.has(id));

  const blocks = [];
  for (const pluginId of orderedIds) {
    if (!enabledSet.has(pluginId)) continue;
    const entry = registry.get(pluginId);
    const component = entry?.manifest?.blocks?.[slotName];
    if (component) {
      blocks.push({ pluginId, component });
    }
  }

  return blocks;
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

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export {
  deny,
  emitBefore,
  HookAbortError,
  isHookAbort,
} from '#/core/events/index.server';

export function __resetRegistry() {
  registry.clear();
  slugIndex.clear();
}

export { registry as _registry, buildCtx as _buildCtx };
