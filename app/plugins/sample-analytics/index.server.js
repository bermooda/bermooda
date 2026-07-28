import logger from '#/utils/logger.server';
import { defineHooks, definePlugin } from '#/core/plugins/index.server';

import DashboardWidgetsBlock from './blocks/dashboard/widgets';
import ProductAfterDescriptionBlock from './blocks/product/after-description';
import { appendRecentEvent } from './data/index.server';

// Hooks only receive the event payload — access plugin data helpers directly.
async function handleOrderCreated(payload) {
  try {
    await appendRecentEvent(payload);
  } catch (err) {
    logger.error({ err }, 'sample-analytics: failed to capture order.created');
  }
}

export const pluginManifest = definePlugin({
  hooks: defineHooks({
    'order.created': handleOrderCreated,
  }),
  blocks: {
    'product.afterDescription': ProductAfterDescriptionBlock,
    'dashboard.widgets': DashboardWidgetsBlock,
  },
});

export default pluginManifest;
