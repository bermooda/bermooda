// app/core/plugins/blocks.server.js
// Slot block contribution from enabled plugins.

import { getEnabledPluginIds } from '#/core/plugins/lifecycle.server';
import {
  listRegisteredPlugins,
  registry,
} from '#/core/plugins/registry.server';
import { get as settingsGet } from '#/core/settings/index.server';

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
