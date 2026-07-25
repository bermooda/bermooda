import { describe, expect, it } from 'vitest';

import {
  createConfig,
  DEFAULT_AUTH,
  PLATFORM_NAME,
  resolveBaseUrl,
} from '#/core/config';

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
  it('applies auth defaults from the core module', () => {
    const config = createConfig(
      {
        baseUrl: 'https://demo.example',
        email: { fromNoReply: 'shop <noreply@example.com>' },
      },
      { nodeEnv: 'production' }
    );

    expect(config.baseUrl).toBe('https://demo.example');
    expect(config.auth).toEqual(DEFAULT_AUTH);
    expect(config.email.fromNoReply).toBe('shop <noreply@example.com>');
    expect(config).not.toHaveProperty('appName');
    expect(config).not.toHaveProperty('appDescription');
    expect(config).not.toHaveProperty('stripe');
    expect(config).not.toHaveProperty('resend');
  });

  it('allows root auth overrides on top of defaults', () => {
    const config = createConfig(
      {
        auth: { adminCallbackUrl: '/admin/home' },
      },
      { nodeEnv: 'development' }
    );

    expect(config.auth.adminCallbackUrl).toBe('/admin/home');
    expect(config.auth.adminBasePath).toBe(DEFAULT_AUTH.adminBasePath);
  });

  it('fills the auto-dev baseUrl when the root omits it', () => {
    const config = createConfig({}, { nodeEnv: 'development' });
    expect(config.baseUrl).toBe('http://localhost:3000');
  });
});

describe('PLATFORM_NAME', () => {
  it('is the hardcoded platform brand', () => {
    expect(PLATFORM_NAME).toBe('bermooda');
  });
});
