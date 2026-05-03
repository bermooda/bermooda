/**
 * Theme cookie utilities for server-side theme detection
 */

const THEME_COOKIE_NAME = 'theme';

/**
 * Parse the theme from a cookie header
 *
 * @param {Request} request - The incoming request
 * @returns {'light' | 'dark' | null} The theme from the cookie, or null if not set
 */
export function getThemeFromRequest(request) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, /** @type {Record<string, string>} */ ({}));

  const theme = cookies[THEME_COOKIE_NAME];
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return null;
}
