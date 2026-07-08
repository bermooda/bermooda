// Shared cart_token cookie helpers for storefront routes.

const CART_COOKIE = 'cart_token';
const CART_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * @param {Request} request
 * @returns {string | null}
 */
export function getCartTokenFromRequest(request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)cart_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * @param {string} token
 * @returns {string}
 */
export function buildCartTokenCookie(token) {
  return `${CART_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${CART_MAX_AGE}; SameSite=Lax`;
}

/**
 * @param {Headers} headers
 * @param {string} token
 */
export function appendCartTokenCookie(headers, token) {
  headers.append('Set-Cookie', buildCartTokenCookie(token));
}
