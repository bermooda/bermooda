// Shared checkout_session cookie helpers for storefront routes.

const CHECKOUT_SESSION_COOKIE = 'checkout_session';

export function getCheckoutSessionIdFromRequest(request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)checkout_session=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

export function buildCheckoutSessionCookie(sessionId) {
  return `${CHECKOUT_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax`;
}

export function appendCheckoutSessionCookie(headers, sessionId) {
  headers.append('Set-Cookie', buildCheckoutSessionCookie(sessionId));
}

export function clearCheckoutSessionCookie(headers) {
  headers.append(
    'Set-Cookie',
    `${CHECKOUT_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}
