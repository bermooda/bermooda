import { describe, expect, it } from 'vitest';

import {
  createConfig,
  DEFAULT_AUTH,
  DEFAULT_DEV_PORT,
  PLATFORM_NAME,
  resolveBaseUrl,
  resolveDevPort,
} from '#/core/config';

describe('resolveDevPort', () => {
  it('defaults to 3000 when PORT is unset', () => {
    expect(resolveDevPort({ port: null })).toBe(DEFAULT_DEV_PORT);
    expect(resolveDevPort({ port: '' })).toBe(DEFAULT_DEV_PORT);
    expect(resolveDevPort({ port: 'not-a-port' })).toBe(DEFAULT_DEV_PORT);
  });

  it('accepts a valid options.port override', () => {
    expect(resolveDevPort({ port: 4000 })).toBe(4000);
    expect(resolveDevPort({ port: '5173' })).toBe(5173);
  });
});

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

  it('defaults to localhost with the resolved port outside production', () => {
    expect(resolveBaseUrl({}, { nodeEnv: 'development', port: null })).toBe(
      'http://localhost:3000'
    );
    expect(resolveBaseUrl({}, { nodeEnv: 'test', port: null })).toBe(
      'http://localhost:3000'
    );
    expect(
      resolveBaseUrl({ baseUrl: '' }, { nodeEnv: 'development', port: null })
    ).toBe('http://localhost:3000');
    expect(
      resolveBaseUrl({ baseUrl: '   ' }, { nodeEnv: 'development', port: 4000 })
    ).toBe('http://localhost:4000');
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
    const config = createConfig({}, { nodeEnv: 'development', port: null });
    expect(config.baseUrl).toBe('http://localhost:3000');
  });

  it('uses options.port for the auto-dev baseUrl', () => {
    const config = createConfig({}, { nodeEnv: 'development', port: 4173 });
    expect(config.baseUrl).toBe('http://localhost:4173');
  });
});

describe('PLATFORM_NAME', () => {
  it('is the hardcoded platform brand', () => {
    expect(PLATFORM_NAME).toBe('bermooda');
  });
});
