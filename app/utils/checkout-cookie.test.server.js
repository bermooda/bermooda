import { describe, expect, it } from 'vitest';

import {
  buildCheckoutSessionCookie,
  clearCheckoutSessionCookie,
  getCheckoutSessionIdFromRequest,
} from '#/utils/checkout-cookie.server';

describe('checkout_session cookie', () => {
  it('is HttpOnly and Secure', () => {
    expect(buildCheckoutSessionCookie('sess_1')).toBe(
      'checkout_session=sess_1; Path=/; SameSite=Lax; HttpOnly; Secure'
    );
  });

  it('clears with Max-Age=0', () => {
    const headers = new Headers();
    clearCheckoutSessionCookie(headers);
    expect(headers.get('Set-Cookie')).toBe(
      'checkout_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly; Secure'
    );
  });

  it('reads the session id', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'checkout_session=sess_1' },
    });
    expect(getCheckoutSessionIdFromRequest(request)).toBe('sess_1');
  });
});
