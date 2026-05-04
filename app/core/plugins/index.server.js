// app/core/plugins/index.server.js
// Full plugin loader implementation for bermooda.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { emit, off, on } from '#/core/events/index.server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PROVIDER_TYPES = ['payment', 'shipping', 'tax'];

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
 * @property {string} [adminRoutes]
 */

/** @type {Map<string, { manifest: PluginManifest, handlers: Map<string, Function> }>} */
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
  if (!VALID_PROVIDER_TYPES.includes(type)) {
    throw new Error(
      `Invalid provider type "${type}". Must be one of: ${VALID_PROVIDER_TYPES.join(', ')}`
    );
  }

  if (!spec || typeof spec !== 'object') {
    throw new Error('Provider spec must be an object');
  }

  return { type, ...spec };
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

  // Settings stub — real service wired in P3-6.
  const settings = {
    get: async (key) => {
      const row = await prisma.setting.findUnique({ where: { key } });
      if (!row) return null;
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    },
    set: async (key, value) => {
      const serialized = JSON.stringify(value);
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: serialized },
        update: { value: serialized },
      });
    },
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

  // Queue stub — real queue wired in later phase.
  const queue = {
    enqueue: async (job, data) =>
      pluginLogger.info({ job, data }, 'queue stub'),
  };

  // i18n stub — real translation wired in P3-7.
  const t = (key) => key;

  return {
    db: prisma,
    settings,
    plugin,
    logger: pluginLogger,
    queue,
    emit,
    t,
  };
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
  if (entry.handlers.size > 0) return; // already enabled

  const { manifest } = entry;
  const settingKey = `plugin.${pluginId}.enabled`;

  await prisma.setting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: 'true' },
    update: { value: 'true' },
  });

  // Register hooks from the manifest.
  if (manifest.hooks) {
    for (const [event, handler] of Object.entries(manifest.hooks)) {
      if (typeof handler === 'function') {
        on(event, handler);
        entry.handlers.set(event, handler);
      }
    }
  }

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

  await prisma.setting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: 'false' },
    update: { value: 'false' },
  });

  const ctx = buildCtx(pluginId);

  if (typeof manifest.onDisable === 'function') {
    await manifest.onDisable(ctx);
  }

  // Deregister all hooks this plugin registered.
  for (const [event, handler] of entry.handlers) {
    off(event, handler);
  }
  entry.handlers.clear();

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
  registry.set(validated.id, { manifest: validated, handlers: new Map() });
}

// ---------------------------------------------------------------------------
// loadPlugins — stable export (Phase 5/7 will wire real discovery)
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
// resolvePluginRoute — stable export (Phase 5 will implement fully)
// ---------------------------------------------------------------------------

/**
 * Resolves an admin route for a plugin.
 * Returns null until Phase 5 implements full route resolution.
 *
 * @param {string} _pluginId
 * @param {string} _path
 * @returns {null}
 */
export function resolvePluginRoute(_pluginId, _path) {
  return null;
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export { registry as _registry, buildCtx as _buildCtx };
