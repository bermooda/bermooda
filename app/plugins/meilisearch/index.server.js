import { definePlugin, defineProvider } from '#/core/plugins/index.server';

import manifest from '#/plugins/meilisearch/manifest';
import { meilisearchProvider } from '#/plugins/meilisearch/provider.server';

export const pluginManifest = definePlugin({
  ...manifest,
  providers: {
    meilisearch: defineProvider('search', {
      provider: meilisearchProvider,
      isDefault: true,
    }),
  },
});

export default pluginManifest;
