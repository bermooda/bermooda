import { definePlugin } from '#/core/plugins/index.server';
import {
  registerProvider as registerSearch,
  setDefaultProvider,
} from '#/core/search/index.server';
import manifest from '#/plugins/meilisearch/manifest';
import { meilisearchProvider } from '#/plugins/meilisearch/provider.server';

export const pluginManifest = definePlugin({
  ...manifest,
  async onEnable() {
    registerSearch('meilisearch', meilisearchProvider, { isDefault: true });
  },
  async onDisable() {
    setDefaultProvider('db');
  },
});

export default pluginManifest;
