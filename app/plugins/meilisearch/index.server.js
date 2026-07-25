import { definePlugin, defineProvider } from '#/core/plugins/index.server';

import { meilisearchProvider } from '#/plugins/meilisearch/provider/index.server';

export const pluginManifest = definePlugin({
  providers: {
    meilisearch: defineProvider('search', {
      provider: meilisearchProvider,
      isDefault: true,
    }),
  },
});

export default pluginManifest;
