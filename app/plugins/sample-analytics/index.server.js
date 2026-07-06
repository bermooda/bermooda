import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { defineHooks, definePlugin } from '#/core/plugins/index.server';

import DashboardWidgetsBlock from '#/plugins/sample-analytics/blocks/dashboard/widgets.jsx';
import ProductAfterDescriptionBlock from '#/plugins/sample-analytics/blocks/product/after-description.jsx';
import manifest from '#/plugins/sample-analytics/manifest';

const PLUGIN_ID = manifest.id;
const EVENTS_KEY = 'recentEvents';
const MAX_EVENTS = 100;

// Hooks only receive the event payload — access Prisma directly.
async function handleOrderCreated(payload) {
  try {
    const row = await prisma.pluginData.findUnique({
      where: { pluginId_key: { pluginId: PLUGIN_ID, key: EVENTS_KEY } },
    });

    const existing = row ? JSON.parse(row.value) : [];
    const event = {
      type: 'order.created',
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      totalCents: payload.totalCents,
      currency: payload.currency,
      capturedAt: new Date().toISOString(),
    };
    const updated = JSON.stringify([event, ...existing].slice(0, MAX_EVENTS));

    await prisma.pluginData.upsert({
      where: { pluginId_key: { pluginId: PLUGIN_ID, key: EVENTS_KEY } },
      create: { pluginId: PLUGIN_ID, key: EVENTS_KEY, value: updated },
      update: { value: updated },
    });
  } catch (err) {
    logger.error({ err }, 'sample-analytics: failed to capture order.created');
  }
}

export const pluginManifest = definePlugin({
  ...manifest,
  hooks: defineHooks({
    'order.created': handleOrderCreated,
  }),
  blocks: {
    'product.afterDescription': ProductAfterDescriptionBlock,
    'dashboard.widgets': DashboardWidgetsBlock,
  },
});

export default pluginManifest;
