// Shared cart_token cookie helpers for storefront routes.

import { readCookie, serializeCookie } from '#/utils/cookies/index.server';

const CART_COOKIE = 'cart_token';
const CART_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * @param {Request} request
 * @returns {string | null}
 */
export function getCartTokenFromRequest(request) {
  return readCookie(request, CART_COOKIE);
}

/**
 * The token is a bearer credential for the cart, so it is HttpOnly (themes
 * receive the cart through loader data, never from `document.cookie`).
 *
 * @param {string} token
 * @returns {string}
 */
export function buildCartTokenCookie(token) {
  return serializeCookie(CART_COOKIE, token, {
    maxAge: CART_MAX_AGE,
    httpOnly: true,
  });
}

/**
 * @param {Headers} headers
 * @param {string} token
 */
export function appendCartTokenCookie(headers, token) {
  headers.append('Set-Cookie', buildCartTokenCookie(token));
}
