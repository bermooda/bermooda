import logger from '#/utils/logger.server';
import { defineHooks, definePlugin } from '#/core/plugins/index.server';

import DashboardWidgetsBlock from '#/plugins/sample-analytics/blocks/dashboard/widgets.jsx';
import ProductAfterDescriptionBlock from '#/plugins/sample-analytics/blocks/product/after-description.jsx';
import { appendRecentEvent } from '#/plugins/sample-analytics/data.server';
import manifest from '#/plugins/sample-analytics/manifest';

// Hooks only receive the event payload — access plugin data helpers directly.
async function handleOrderCreated(payload) {
  try {
    await appendRecentEvent(payload);
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
