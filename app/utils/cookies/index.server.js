// Server-side Set-Cookie builder shared by storefront cookies.

export { getCookie, readCookie } from '#/utils/cookies';

// Same rule as the better-auth cookies (`buildAuthAdvancedConfig`): Secure
// everywhere except local development, which runs over plain HTTP.
const SECURE = process.env.NODE_ENV !== 'development';

/**
 * Build a `Set-Cookie` header value. Values are URI-encoded; `Secure` is added
 * outside development.
 *
 * @param {string} name
 * @param {string} value
 * @param {{ maxAge?: number, httpOnly?: boolean, sameSite?: 'Lax'|'Strict'|'None', path?: string }} [options]
 * @returns {string}
 */
export function serializeCookie(
  name,
  value,
  { maxAge, httpOnly = false, sameSite = 'Lax', path = '/' } = {}
) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  parts.push(`SameSite=${sameSite}`);
  if (httpOnly) parts.push('HttpOnly');
  if (SECURE) parts.push('Secure');
  return parts.join('; ');
}
