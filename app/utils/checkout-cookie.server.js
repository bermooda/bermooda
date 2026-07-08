// Shared checkout_session cookie helpers for storefront routes.

const CHECKOUT_SESSION_COOKIE = 'checkout_session';

/**
 * @param {Request} request
 * @returns {string | null}
 */
export function getCheckoutSessionIdFromRequest(request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)checkout_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * @param {string} sessionId
 * @returns {string}
 */
export function buildCheckoutSessionCookie(sessionId) {
  return `${CHECKOUT_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`;
}

/**
 * @param {Headers} headers
 * @param {string} sessionId
 */
export function appendCheckoutSessionCookie(headers, sessionId) {
  headers.append('Set-Cookie', buildCheckoutSessionCookie(sessionId));
}

/**
 * @param {Headers} headers
 */
export function clearCheckoutSessionCookie(headers) {
  headers.append(
    'Set-Cookie',
    `${CHECKOUT_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
