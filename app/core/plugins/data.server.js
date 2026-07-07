import prisma from '#/libs/prisma.server';

/**
 * Reads a JSON value from plugin-scoped storage.
 *
 * @param {string} pluginId
 * @param {string} key
 * @param {*} [fallback=null]
 * @returns {Promise<*>}
 */
export async function readPluginJson(pluginId, key, fallback = null) {
  const row = await prisma.pluginData.findUnique({
    where: { pluginId_key: { pluginId, key } },
  });
  if (!row) return fallback;

  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON-serializable value to plugin-scoped storage.
 *
 * @param {string} pluginId
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function writePluginJson(pluginId, key, value) {
  const serialized = JSON.stringify(value);
  await prisma.pluginData.upsert({
    where: { pluginId_key: { pluginId, key } },
    create: { pluginId, key, value: serialized },
    update: { value: serialized },
  });
}
