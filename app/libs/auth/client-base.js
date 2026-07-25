import config from '#bermooda.config';

/**
 * Base URL for better-auth browser clients.
 * Uses the browser origin when available, otherwise config.baseUrl for SSR.
 *
 * @returns {string}
 */
export function getAuthClientBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return config.baseUrl;
}
