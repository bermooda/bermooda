// Theme cookie utilities for server-side color-mode detection.

import { readCookie } from '#/utils/cookies';

const THEME_COOKIE_NAME = 'theme';

/**
 * Parse the color mode from the `theme` cookie.
 *
 * @param {Request} request - The incoming request
 * @returns {'light' | 'dark' | null} The theme from the cookie, or null if not set
 */
export function getThemeFromRequest(request) {
  const theme = readCookie(request, THEME_COOKIE_NAME);
  return theme === 'light' || theme === 'dark' ? theme : null;
}
