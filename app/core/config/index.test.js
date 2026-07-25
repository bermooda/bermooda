import { describe, expect, it } from 'vitest';

import { createConfig, resolveBaseUrl } from '#/core/config';

describe('resolveBaseUrl', () => {
  it('uses the root baseUrl when set, including in development', () => {
    expect(
      resolveBaseUrl(
        { baseUrl: 'https://shop.example' },
        { nodeEnv: 'development' }
      )
    ).toBe('https://shop.example');
  });

  it('strips trailing slashes from an explicit baseUrl', () => {
    expect(
      resolveBaseUrl(
        { baseUrl: 'https://shop.example/' },
        { nodeEnv: 'production' }
      )
    ).toBe('https://shop.example');
  });

  it('defaults to localhost outside production when baseUrl is unset', () => {
    expect(resolveBaseUrl({}, { nodeEnv: 'development' })).toBe(
      'http://localhost:3000'
    );
    expect(resolveBaseUrl({}, { nodeEnv: 'test' })).toBe(
      'http://localhost:3000'
    );
    expect(resolveBaseUrl({ baseUrl: '' }, { nodeEnv: 'development' })).toBe(
      'http://localhost:3000'
    );
    expect(resolveBaseUrl({ baseUrl: '   ' }, { nodeEnv: 'development' })).toBe(
      'http://localhost:3000'
    );
  });

  it('requires baseUrl in production when unset', () => {
    expect(() => resolveBaseUrl({}, { nodeEnv: 'production' })).toThrow(
      /baseUrl.*required/i
    );
  });
});

describe('createConfig', () => {
  it('derives runtime config from the root export', () => {
    const config = createConfig(
      {
        appName: 'demo',
        baseUrl: 'https://demo.example',
        auth: { adminBasePath: '/admin/auth' },
      },
      { nodeEnv: 'production' }
    );

    expect(config.appName).toBe('demo');
    expect(config.baseUrl).toBe('https://demo.example');
    expect(config.auth.adminBasePath).toBe('/admin/auth');
  });

  it('fills the auto-dev baseUrl when the root omits it', () => {
    const config = createConfig(
      { appName: 'demo' },
      { nodeEnv: 'development' }
    );
    expect(config.baseUrl).toBe('http://localhost:3000');
  });
});
