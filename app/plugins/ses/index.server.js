import { definePlugin, defineProvider } from '#/core/plugins/index.server';

import { createSesEmailProvider } from './provider/index.server';

export const pluginManifest = definePlugin({
  providers: {
    ses: defineProvider('email', createSesEmailProvider()),
  },
});

export default pluginManifest;
