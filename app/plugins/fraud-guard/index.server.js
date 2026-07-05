import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

import { defineHooks, definePlugin, deny } from '#/core/plugins/index.server';
import manifest from '#/plugins/fraud-guard/manifest';

const HOLD_KEY = 'holds';

async function assertNotHeld(orderId) {
  const row = await prisma.pluginData.findUnique({
    where: { pluginId_key: { pluginId: manifest.id, key: HOLD_KEY } },
  });
  const holds = row ? JSON.parse(row.value) : [];
  if (holds.includes(orderId)) {
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
