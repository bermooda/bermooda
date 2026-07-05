// app/core/admin/slots.server.js
// Admin slot catalog and plugin block resolution for admin views.

import { getPluginBlocksForSlot } from '#/core/plugins/index.server';

/**
 * Well-known slot names available for plugin blocks in admin views.
 * @type {string[]}
 */
export const ADMIN_SLOT_NAMES = [
  'dashboard.widgets',
  'order.detail',
  'customer.detail',
  'product.editor',
];

/**
 * Returns the ordered list of plugin blocks for a given admin slot.
 *
 * @param {string} slotName
 * @returns {Promise<Array<{ pluginId: string, component: unknown }>>}
 */
export async function getAdminSlotBlocks(slotName) {
  return getPluginBlocksForSlot(slotName);
}

/**
 * Returns a slot-keyed map of plugin blocks for the requested admin slot names.
 *
 * @param {string[]} slotNames
 * @returns {Promise<Record<string, Array<{ pluginId: string, component: unknown }>>>}
 */
export async function getAdminSlotBlocksMap(slotNames = []) {
  const entries = await Promise.all(
    slotNames.map(async (slotName) => [
      slotName,
      await getAdminSlotBlocks(slotName),
    ])
  );

  return Object.fromEntries(entries);
}
