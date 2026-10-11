import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getClientIp,
  getRequestOrigin,
  parseTrustedProxies,
} from '#/utils/request/index.server';

/**
 * @param {Record<string, string>} headers
 * @param {string} [url]
 */
function req(headers, url = 'http://shop.example/') {
  return new Request(url, { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseTrustedProxies', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['0', 0],
    ['2', 2],
    ['-1', 1],
    ['1.5', 1],
    ['true', 1],
  ])('parses %j as %i', (raw, expected) => {
    expect(parseTrustedProxies(raw)).toBe(expected);
  });

  it('reads TRUST_PROXY by default', () => {
    vi.stubEnv('TRUST_PROXY', '3');
    expect(parseTrustedProxies()).toBe(3);
  });
});

describe('getClientIp', () => {
  it('takes the address added by the single trusted proxy (rightmost)', () => {
    const request = req({ 'X-Forwarded-For': '6.6.6.6, 203.0.113.7' });
    expect(getClientIp(request, 1)).toBe('203.0.113.7');
  });

  it('ignores client-supplied entries left of the trusted hops', () => {
    const spoofed = req({
      'X-Forwarded-For': '1.1.1.1, 2.2.2.2, 203.0.113.7, 10.0.0.2',
    });
    expect(getClientIp(spoofed, 2)).toBe('203.0.113.7');
  });

  it('uses the leftmost entry when there are fewer hops than proxies', () => {
    expect(getClientIp(req({ 'X-Forwarded-For': '203.0.113.7' }), 3)).toBe(
      '203.0.113.7'
    );
  });

  it('falls back to X-Real-IP without X-Forwarded-For', () => {
    expect(getClientIp(req({ 'X-Real-IP': ' 198.51.100.4 ' }), 1)).toBe(
      '198.51.100.4'
    );
  });

  it('trusts no header when TRUST_PROXY=0', () => {
    const request = req({
      'X-Forwarded-For': '203.0.113.7',
      'X-Real-IP': '198.51.100.4',
    });
    expect(getClientIp(request, 0)).toBeNull();
  });

  it('returns null without proxy headers', () => {
    expect(getClientIp(req({}), 1)).toBeNull();
  });

  it('caps oversized values so they cannot bloat rate-limit keys', () => {
    const ip = getClientIp(req({ 'X-Forwarded-For': 'a'.repeat(5000) }), 1);
    expect(ip).toHaveLength(64);
  });
});

describe('getRequestOrigin', () => {
  it('combines the request host with the baseUrl scheme', () => {
    expect(
      getRequestOrigin(req({}, 'http://shop.example.de:8080/x'), 'https://a.b')
    ).toBe('https://shop.example.de:8080');
  });

  it('ignores X-Forwarded-Host and X-Forwarded-Proto', () => {
    const request = req({
      'X-Forwarded-Host': 'evil.example',
      'X-Forwarded-Proto': 'http',
    });
    expect(getRequestOrigin(request, 'https://shop.example')).toBe(
      'https://shop.example'
    );
  });
});
