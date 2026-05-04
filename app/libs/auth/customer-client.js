import { createAuthClient } from 'better-auth/react';

import config from '#/config';

/**
 * Get the base URL for the customer auth client.
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

export const customerAuthClient = createAuthClient({
  baseURL: getBaseUrl(),
  basePath: config.auth.customerBasePath,
  // No twoFactor plugin for customers (deferred to a future phase)
});
