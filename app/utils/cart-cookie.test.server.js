import { describe, expect, it } from 'vitest';

import {
  buildCartTokenCookie,
  getCartTokenFromRequest,
} from '#/utils/cart-cookie.server';

describe('cart_token cookie', () => {
  it('is HttpOnly and Secure with a 30-day max age', () => {
    expect(buildCartTokenCookie('tok_1')).toBe(
      'cart_token=tok_1; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly; Secure'
    );
  });

  it('reads the token and ignores malformed values', () => {
    const ok = new Request('http://localhost/', {
      headers: { cookie: 'cart_token=tok_1' },
    });
    const bad = new Request('http://localhost/', {
      headers: { cookie: 'cart_token=%E0%A4%A' },
    });
    expect(getCartTokenFromRequest(ok)).toBe('tok_1');
    expect(getCartTokenFromRequest(bad)).toBeNull();
  });
});
