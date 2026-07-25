import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import config from '#bermooda.config';
import { getAuthClientBaseUrl } from '#/libs/auth/client-base';

export const adminAuthClient = createAuthClient({
  baseURL: getAuthClientBaseUrl(),
  basePath: config.auth.adminBasePath,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/admin/verify-2fa';
      },
    }),
  ],
});
