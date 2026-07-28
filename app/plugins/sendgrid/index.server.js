import { definePlugin, defineProvider } from '#/core/plugins/index.server';

import { createSendGridEmailProvider } from '#/plugins/sendgrid/provider/index.server';

export const pluginManifest = definePlugin({
  providers: {
    sendgrid: defineProvider('email', createSendGridEmailProvider()),
  },
});

export default pluginManifest;
