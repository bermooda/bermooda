// app/core/plugins/ctx.server.js
// Plugin context factory for hooks and lifecycle callbacks.

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import queue from '#/libs/queue.server';
import { emit } from '#/core/events/index.server';
import { translate } from '#/core/i18n';
import { DEFAULT_LOCALE } from '#/core/i18n/locales';
import {
  get as settingsGet,
  set as settingsSet,
} from '#/core/settings/index.server';

/**
 * Builds the plugin ctx object for a given pluginId.
 *
 * @param {string} pluginId
 * @param {{ messages?: Record<string, unknown> }} [options]
 * @returns {Object}
 */
export function buildCtx(pluginId, options = {}) {
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
    /**
     * @deprecated Prefer domain APIs; raw Prisma bypasses invariants.
     */
    db: prisma,
    settings,
    plugin,
    logger: pluginLogger,
    queue: pluginQueue,
    emit,
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
