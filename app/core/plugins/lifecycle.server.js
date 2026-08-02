// app/core/plugins/lifecycle.server.js
// Enable/disable, persisted enabled state, and plugin ordering.

import logger from '#/utils/logger.server';
import { invalidateCachePrefix } from '#/utils/cache/index.server';
import { isHookAbort, off, on } from '#/core/events/index.server';
import { isBeforeHookEvent } from '#/core/events/names';
import { buildLifecycleCtx } from '#/core/plugins/ctx.server';
import {
  registerProvidersForPlugin,
  unregisterProvidersForPlugin,
} from '#/core/plugins/providers.server';
import {
  listRegisteredPlugins,
  registry,
} from '#/core/plugins/registry.server';
import {
  get as settingsGet,
  set as settingsSet,
} from '#/core/settings/index.server';

/**
 * Returns persisted enabled plugin ids.
 *
 * @returns {Promise<string[]>}
 */
export async function getEnabledPluginIds() {
  const enabledRaw = await settingsGet('enabledPlugins');
  return Array.isArray(enabledRaw) ? enabledRaw : [];
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
 * @param {Array<{ id: string }>} plugins
 * @param {string[]} pluginOrder
 * @returns {Array<{ id: string }>}
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
 * Whether a registered plugin declares at least one provider of the given type.
 *
 * @param {string} pluginId
 * @param {string} type
 * @returns {boolean}
 */
export function pluginProvidesType(pluginId, type) {
  const entry = registry.get(pluginId);
  const providerMap = entry?.manifest?.providers;
  if (!providerMap || typeof providerMap !== 'object') return false;

  return Object.values(providerMap).some(
    (spec) => spec && typeof spec === 'object' && spec.type === type
  );
}

/**
 * Persists enabled state and wires or unwires the plugin live.
 * Enabling an email-provider plugin disables every other email-provider plugin
 * so only one transport is active.
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
  /** @type {string[]} */
  let nextEnabled = [...previousEnabled];

  if (enabled) {
    if (pluginProvidesType(pluginId, 'email')) {
      const siblingEmailPlugins = previousEnabled.filter(
        (id) => id !== pluginId && pluginProvidesType(id, 'email')
      );

      for (const siblingId of siblingEmailPlugins) {
        const idx = nextEnabled.indexOf(siblingId);
        if (idx !== -1) nextEnabled.splice(idx, 1);
      }

      await settingsSet('enabledPlugins', nextEnabled);

      try {
        for (const siblingId of siblingEmailPlugins) {
          await disable(siblingId);
        }
      } catch (err) {
        await settingsSet('enabledPlugins', previousEnabled);
        for (const siblingId of siblingEmailPlugins) {
          if (previousEnabled.includes(siblingId)) {
            try {
              await enable(siblingId);
            } catch {
              // Best-effort restore.
            }
          }
        }
        throw err;
      }
    }

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
    // If enable left the process wired (or isEnabled still true), unwind so
    // persistence and in-memory state stay aligned.
    if (enabled) {
      const entry = registry.get(pluginId);
      if (entry?.isEnabled) {
        try {
          await disable(pluginId);
        } catch {
          // Best-effort unwind after settings rollback.
        }
      }
    }
    throw err;
  }

  invalidateCachePrefix('i18n:');
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
  invalidateCachePrefix('i18n:');
  return fullOrder;
}

/**
 * Unregisters hooks and providers for a partially-enabled plugin without
 * calling onDisable (used when enable fails before success).
 *
 * @param {{ handlers: Map<string, Function>, providers: unknown[], isEnabled: boolean, manifest: object }} entry
 * @returns {void}
 */
function unwindPartialEnable(entry) {
  unregisterProvidersForPlugin(entry);

  for (const [event, handler] of entry.handlers) {
    off(event, handler);
  }
  entry.handlers.clear();
  entry.isEnabled = false;
}

/**
 * Enables a plugin by registering hooks/providers and calling onEnable.
 * Hooks/providers are unwound and isEnabled stays false if onEnable throws.
 *
 * @param {string} pluginId
 * @returns {Promise<void>}
 */
export async function enable(pluginId) {
  const entry = registry.get(pluginId);
  if (!entry) throw new Error(`Plugin "${pluginId}" is not registered`);
  if (entry.isEnabled) return;

  const { manifest } = entry;

  try {
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

    entry.isEnabled = true;
    logger.info({ pluginId }, 'Plugin enabled');
  } catch (err) {
    unwindPartialEnable(entry);
    throw err;
  }
}

/**
 * Disables a plugin by calling onDisable and removing hooks/providers.
 *
 * @param {string} pluginId
 * @returns {Promise<void>}
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

/**
 * Enable plugins persisted in settings (called during async bootstrap).
 *
 * @returns {Promise<void>}
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
