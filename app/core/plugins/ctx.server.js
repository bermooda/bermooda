// app/core/plugins/ctx.server.js
// Plugin context factory for hooks and lifecycle callbacks.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import queue from '#/libs/queue.server';
import { queueEmit } from '#/core/events/job.server';
import { translate } from '#/core/i18n';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';
import { pluginSettingStorageKey } from '#/core/plugins/settings.server';
import {
  get as settingsGet,
  set as settingsSet,
} from '#/core/settings/index.server';

/**
 * Builds the plugin ctx object for a given pluginId.
 *
 * Prefer `ctx.plugin` (PluginData) and `ctx.settings.getPluginSetting` /
 * `setPluginSetting` (namespaced `plugin.<id>.<key>` Setting rows) over
 * unnamespaced `ctx.settings.get/set` and the deprecated `ctx.db` escape hatch.
 *
 * @param {string} pluginId
 * @param {{ messages?: Record<string, unknown> }} [options]
 * @returns {Object}
 */
export function buildCtx(pluginId, options = {}) {
  const { messages = {} } = options;
  const pluginLogger = logger.child({ plugin: pluginId });

  const settings = {
    /**
     * Global Setting table access. Prefer `getPluginSetting` /
     * `setPluginSetting` so keys stay under `plugin.<id>.*`.
     *
     * @param {string} key
     * @returns {Promise<unknown>}
     */
    get: (key) => settingsGet(key),
    /**
     * @param {string} key
     * @param {unknown} value
     * @returns {Promise<void>}
     */
    set: (key, value) => settingsSet(key, value),
    /**
     * Read a package-scoped setting (`plugin.<pluginId>.<key>`).
     *
     * @param {string} key
     * @returns {Promise<unknown>}
     */
    getPluginSetting: (key) =>
      settingsGet(pluginSettingStorageKey(pluginId, key)),
    /**
     * Write a package-scoped setting (`plugin.<pluginId>.<key>`).
     *
     * @param {string} key
     * @param {unknown} value
     * @returns {Promise<void>}
     */
    setPluginSetting: (key, value) =>
      settingsSet(pluginSettingStorageKey(pluginId, key), value),
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
    /**
     * Enqueue a LiteQuu job. Prefer job names already registered by core or
     * this plugin — arbitrary names will not run.
     *
     * @param {string} jobName
     * @param {unknown} data
     * @returns {void}
     */
    add: (jobName, data) => {
      const job = queue.createJob(jobName);
      job.add(data);
      pluginLogger.info({ jobName }, 'Plugin queued job');
    },
    /**
     * @param {string} jobName
     * @param {unknown} data
     * @returns {void}
     */
    enqueue: (jobName, data) => {
      pluginQueue.add(jobName, data);
    },
  };

  const t = (key, params) => translate(key, params, messages);

  return {
    /**
     * @deprecated Prefer domain APIs from `#/core/*`; raw Prisma bypasses invariants.
     */
    db: prisma,
    settings,
    plugin,
    logger: pluginLogger,
    queue: pluginQueue,
    emit: queueEmit,
    t,
  };
}

/**
 * Builds plugin ctx for enable/disable lifecycle, loading default-locale messages.
 *
 * Uses a dynamic import of `loadMessages` to avoid a module cycle:
 * plugins → i18n → plugins (getRegisteredPlugin).
 *
 * @param {string} pluginId
 * @returns {Promise<Object>}
 */
export async function buildLifecycleCtx(pluginId) {
  const { loadMessages } = await import('#/core/i18n/index.server');
  const messages = await loadMessages(DEFAULT_LOCALE);
  return buildCtx(pluginId, { messages });
}
