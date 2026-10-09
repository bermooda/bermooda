import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCookie, readCookie } from '#/utils/cookies';

describe('getCookie', () => {
  it('matches the exact cookie name', () => {
    const header = 'xcart_token=evil; cart_token=tok_1; cart_token_old=x';
    expect(getCookie(header, 'cart_token')).toBe('tok_1');
  });

  it('decodes values and strips surrounding quotes', () => {
    expect(getCookie('ref=SUMMER%2024', 'ref')).toBe('SUMMER 24');
    expect(getCookie('ref="ABC"', 'ref')).toBe('ABC');
    expect(getCookie('token=a=b=c', 'token')).toBe('a=b=c');
  });

  it('returns null for missing cookies and empty headers', () => {
    expect(getCookie('a=1', 'b')).toBeNull();
    expect(getCookie('', 'a')).toBeNull();
    expect(getCookie(null, 'a')).toBeNull();
  });

  it('returns null instead of throwing on malformed encoding', () => {
    expect(getCookie('bermooda_ref=%E0%A4%A', 'bermooda_ref')).toBeNull();
  });
});

describe('readCookie', () => {
  it('reads from the request Cookie header', () => {
    const request = new Request('http://localhost/', {
      headers: { cookie: 'currency=EUR' },
    });
    expect(readCookie(request, 'currency')).toBe('EUR');
  });
});

describe('serializeCookie', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(nodeEnv) {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.resetModules();
    return import('#/utils/cookies/index.server');
  }

  it('adds Secure outside development', async () => {
    const { serializeCookie } = await load('production');
    expect(
      serializeCookie('cart_token', 'tok 1', { maxAge: 60, httpOnly: true })
    ).toBe(
      'cart_token=tok%201; Path=/; Max-Age=60; SameSite=Lax; HttpOnly; Secure'
    );
  });

  it('omits Secure in development (plain HTTP)', async () => {
    const { serializeCookie } = await load('development');
    expect(serializeCookie('locale', 'de')).toBe(
      'locale=de; Path=/; SameSite=Lax'
    );
  });
});
