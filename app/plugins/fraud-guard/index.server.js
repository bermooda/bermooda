import logger from '#/utils/logger.server';
import { readPluginData } from '#/core/plugins/data/index.server';
import { defineHooks, definePlugin, deny } from '#/core/plugins/index.server';

import pkg from '#/plugins/fraud-guard/package.json';

const PLUGIN_ID = pkg.name;
const HOLD_KEY = 'holds';

async function assertNotHeld(orderId) {
  const holds = await readPluginData(PLUGIN_ID, HOLD_KEY, []);
  if (Array.isArray(holds) && holds.includes(orderId)) {
    logger.warn({ orderId }, 'fraud-guard: blocking fulfillment');
    deny('This order is on a fraud hold and cannot be fulfilled.', {
      code: 'FRAUD_HOLD',
    });
  }
}

export const pluginManifest = definePlugin({
  hooks: defineHooks({
    'before.shipment.create': ({ orderId }) => assertNotHeld(orderId),
    'before.shipment.ship': ({ orderId }) => assertNotHeld(orderId),
  }),
});

export default pluginManifest;
