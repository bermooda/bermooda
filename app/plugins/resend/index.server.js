import { definePlugin, defineProvider } from '#/core/plugins/index.server';

import { createResendEmailProvider } from '#/plugins/resend/provider/index.server';

export const pluginManifest = definePlugin({
  providers: {
    resend: defineProvider('email', createResendEmailProvider()),
  },
});

export default pluginManifest;
