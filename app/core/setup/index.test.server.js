// app/core/setup/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    user: { count: vi.fn() },
    setting: { findUnique: vi.fn() },
  },
}));

vi.mock('#/core/admin-onboarding/index.server', () => ({
  isOnboardingAvailable: vi.fn(),
  createFirstAdmin: vi.fn(),
  mapOnboardingActionError: vi.fn(),
  validateOnboardingInput: vi.fn(),
}));

vi.mock('#/core/api-keys/index.server', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import {
  createFirstAdmin,
  isOnboardingAvailable,
} from '#/core/admin-onboarding/index.server';
import { createApiKey, listApiKeys } from '#/core/api-keys/index.server';

import {
  checkSetupToken,
  createBootstrapApiKey,
  createBootstrapApiKeyTrusted,
  createSetupAdmin,
  extractSetupToken,
  getSetupStatus,
  parseSetupAdminInput,
  setupTokensMatch,
} from './index.server';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SETUP_TOKEN;
});

describe('setupTokensMatch', () => {
  it('matches equal tokens', () => {
    expect(setupTokensMatch('abc', 'abc')).toBe(true);
  });

  it('rejects mismatched or empty tokens', () => {
    expect(setupTokensMatch('abc', 'abd')).toBe(false);
    expect(setupTokensMatch('', 'abc')).toBe(false);
    expect(setupTokensMatch('abc', '')).toBe(false);
  });

  it('rejects tokens of a different length without throwing', () => {
    expect(setupTokensMatch('abc', 'abcdef')).toBe(false);
    expect(setupTokensMatch('a-much-longer-token', 'abc')).toBe(false);
  });
});

describe('extractSetupToken', () => {
  it('prefers X-Setup-Token over Authorization', () => {
    const request = new Request('http://localhost/setup', {
      headers: {
        'X-Setup-Token': 'from-header',
        'Authorization': 'Bearer from-bearer',
      },
    });
    expect(extractSetupToken(request)).toBe('from-header');
  });

  it('reads Bearer token when header is absent', () => {
    const request = new Request('http://localhost/setup', {
      headers: { Authorization: 'Bearer secret-token' },
    });
    expect(extractSetupToken(request)).toBe('secret-token');
  });

  it('accepts a case-insensitive Bearer scheme', () => {
    const request = new Request('http://localhost/setup', {
      headers: { Authorization: 'bearer   secret-token' },
    });
    expect(extractSetupToken(request)).toBe('secret-token');
  });

  it('returns an empty string for other schemes or no headers', () => {
    expect(
      extractSetupToken(
        new Request('http://localhost/setup', {
          headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        })
      )
    ).toBe('');
    expect(extractSetupToken(new Request('http://localhost/setup'))).toBe('');
  });
});

describe('checkSetupToken', () => {
  const withToken = (token) =>
    new Request('http://localhost/setup', {
      headers: token ? { 'X-Setup-Token': token } : {},
    });

  it('refuses required routes when SETUP_TOKEN is unset', () => {
    expect(checkSetupToken(withToken('anything'))).toMatchObject({
      status: 401,
      body: { code: 'SETUP_TOKEN_REQUIRED' },
    });
  });

  it('lets optional routes through when SETUP_TOKEN is unset', () => {
    expect(checkSetupToken(withToken(null), { optional: true })).toBeNull();
  });

  it('accepts the configured token', () => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';
    expect(checkSetupToken(withToken('shop-setup-secret'))).toBeNull();
    expect(
      checkSetupToken(withToken('shop-setup-secret'), { optional: true })
    ).toBeNull();
  });

  it('rejects a missing or wrong token when SETUP_TOKEN is set', () => {
    process.env.SETUP_TOKEN = 'shop-setup-secret';
    for (const options of [{}, { optional: true }]) {
      expect(checkSetupToken(withToken(null), options)).toMatchObject({
        status: 401,
        body: { code: 'SETUP_TOKEN_REQUIRED' },
      });
      expect(checkSetupToken(withToken('wrong'), options)).toMatchObject({
        status: 401,
      });
    }
  });
});

describe('parseSetupAdminInput', () => {
  it('defaults confirmPassword to password', () => {
    expect(
      parseSetupAdminInput({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'long-enough-password',
      })
    ).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'long-enough-password',
      confirmPassword: 'long-enough-password',
    });
  });
});

describe('getSetupStatus', () => {
  it('reports bootstrap availability from counts', async () => {
    isOnboardingAvailable.mockResolvedValue(false);
    prisma.user.count.mockResolvedValue(1);
    listApiKeys.mockResolvedValue({ apiKeys: [], total: 0, page: 1, limit: 1 });
    prisma.setting.findUnique.mockResolvedValue({ value: 'true' });

    await expect(getSetupStatus()).resolves.toEqual({
      onboardingAvailable: false,
      adminExists: true,
      adminSetupComplete: true,
      apiKeyCount: 0,
      bootstrapApiKeyAvailable: true,
      setupTokenConfigured: false,
    });
  });
});

describe('createSetupAdmin', () => {
  it('delegates to createFirstAdmin and returns a safe admin shape', async () => {
    createFirstAdmin.mockResolvedValue({
      id: 'u1',
      email: 'ada@example.com',
      name: 'Ada',
      role: 'admin',
      passwordHash: 'secret',
    });

    await expect(
      createSetupAdmin({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'long-enough-password',
      })
    ).resolves.toEqual({
      admin: {
        id: 'u1',
        email: 'ada@example.com',
        name: 'Ada',
        role: 'admin',
      },
    });
  });
});

describe('createBootstrapApiKeyTrusted', () => {
  it('creates a key when none exist', async () => {
    listApiKeys.mockResolvedValue({ apiKeys: [], total: 0, page: 1, limit: 1 });
    createApiKey.mockResolvedValue({
      key: 'berm_raw',
      record: { id: 'k1', label: 'bootstrap', scopes: ['admin'] },
    });

    await expect(createBootstrapApiKeyTrusted()).resolves.toEqual({
      key: 'berm_raw',
      apiKey: { id: 'k1', label: 'bootstrap', scopes: ['admin'] },
    });
  });

  it('rejects when a key already exists', async () => {
    listApiKeys.mockResolvedValue({
      apiKeys: [{ id: 'k1' }],
      total: 1,
      page: 1,
      limit: 1,
    });

    await expect(createBootstrapApiKeyTrusted()).rejects.toMatchObject({
      code: 'BOOTSTRAP_KEY_EXISTS',
      status: 409,
    });
  });
});

describe('createBootstrapApiKey', () => {
  it('requires an admin user', async () => {
    isOnboardingAvailable.mockResolvedValue(true);
    prisma.user.count.mockResolvedValue(0);
    listApiKeys.mockResolvedValue({ apiKeys: [], total: 0, page: 1, limit: 1 });
    prisma.setting.findUnique.mockResolvedValue(null);

    await expect(createBootstrapApiKey()).rejects.toMatchObject({
      code: 'ADMIN_REQUIRED',
      status: 422,
    });
  });
});
