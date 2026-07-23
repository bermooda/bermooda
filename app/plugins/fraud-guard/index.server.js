import logger from '#/utils/logger.server';
import { readPluginData } from '#/core/plugins/data/index.server';
import { defineHooks, definePlugin, deny } from '#/core/plugins/index.server';

import manifest from '#/plugins/fraud-guard/manifest';

const HOLD_KEY = 'holds';

async function assertNotHeld(orderId) {
  const holds = await readPluginData(manifest.id, HOLD_KEY, []);
  if (Array.isArray(holds) && holds.includes(orderId)) {
    logger.warn({ orderId }, 'fraud-guard: blocking fulfillment');
    deny('This order is on a fraud hold and cannot be fulfilled.', {
      code: 'FRAUD_HOLD',
    });
  }
}

export const pluginManifest = definePlugin({
  ...manifest,
  hooks: defineHooks({
    'before.shipment.create': ({ orderId }) => assertNotHeld(orderId),
    'before.shipment.ship': ({ orderId }) => assertNotHeld(orderId),
  }),
});

export default pluginManifest;
