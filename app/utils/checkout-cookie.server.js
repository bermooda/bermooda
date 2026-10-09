// Shared checkout_session cookie helpers for storefront routes.

import { readCookie, serializeCookie } from '#/utils/cookies/index.server';

const CHECKOUT_SESSION_COOKIE = 'checkout_session';

/**
 * @param {Request} request
 * @returns {string | null}
 */
export function getCheckoutSessionIdFromRequest(request) {
  return readCookie(request, CHECKOUT_SESSION_COOKIE);
}

/**
 * @param {string} sessionId
 * @returns {string}
 */
export function buildCheckoutSessionCookie(sessionId) {
  return serializeCookie(CHECKOUT_SESSION_COOKIE, sessionId, {
    httpOnly: true,
  });
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
    serializeCookie(CHECKOUT_SESSION_COOKIE, '', { maxAge: 0, httpOnly: true })
  );
}
