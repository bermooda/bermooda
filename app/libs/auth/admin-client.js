import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import config from '#/config';

/**
 * Get the base URL for the admin auth client.
 * Uses the browser's current origin when available (for network access),
 * otherwise falls back to the config baseUrl (for SSR).
 * @returns {string} The base URL to use for auth requests
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return config.baseUrl;
}

export const adminAuthClient = createAuthClient({
  baseURL: getBaseUrl(),
  basePath: config.auth.adminBasePath,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = '/admin/verify-2fa';
      },
    }),
  ],
});
