import { definePlugin, defineProvider } from '#/core/plugins/index.server';

import { createResendEmailProvider } from './provider/index.server';

export const pluginManifest = definePlugin({
  providers: {
    resend: defineProvider('email', createResendEmailProvider()),
  },
});

export default pluginManifest;
