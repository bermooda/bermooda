// app/core/api-keys/index.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock prisma — must be hoisted before other imports
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => {
  const apiKey = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { default: { apiKey } };
});

import prisma from '#/libs/prisma.server';

import {
  API_KEY_SCOPES,
  createApiKey,
  getApiKey,
  listApiKeys,
  parseApiKeyListParams,
  parseCreateApiKeyFormData,
  parseCreateApiKeyInput,
  revokeApiKey,
  serializeApiKey,
  validateApiKey,
} from './index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides = {}) {
  return {
    id: 'key-1',
    label: 'Test key',
    keyHash: 'fakehash',
    scopes: '["admin"]',
    lastUsedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('parseCreateApiKeyInput', () => {
  it('normalizes label and scopes', () => {
    expect(
      parseCreateApiKeyInput({ label: '  My key  ', scopes: ['admin'] })
    ).toEqual({
      label: 'My key',
      scopes: ['admin'],
      expiresAt: null,
    });
  });

  it('defaults scopes to admin when omitted', () => {
    expect(parseCreateApiKeyInput({ label: 'Default scopes' })).toEqual({
      label: 'Default scopes',
      scopes: ['admin'],
      expiresAt: null,
    });
  });

  it('throws LABEL_REQUIRED when label is empty', () => {
    expect(() => parseCreateApiKeyInput({ label: '  ' })).toThrowError(
      expect.objectContaining({ code: 'LABEL_REQUIRED' })
    );
  });

  it('throws SCOPES_REQUIRED when scopes is empty', () => {
    expect(() =>
      parseCreateApiKeyInput({ label: 'x', scopes: [] })
    ).toThrowError(expect.objectContaining({ code: 'SCOPES_REQUIRED' }));
  });

  it('throws SCOPES_INVALID for unknown scopes', () => {
    expect(() =>
      parseCreateApiKeyInput({ label: 'x', scopes: ['billing'] })
    ).toThrowError(expect.objectContaining({ code: 'SCOPES_INVALID' }));
  });

  it('parses expiresAt', () => {
    const expiresAt = new Date('2027-01-01T00:00:00Z');
    expect(parseCreateApiKeyInput({ label: 'x', expiresAt })).toEqual({
      label: 'x',
      scopes: ['admin'],
      expiresAt,
    });
  });
});

describe('parseCreateApiKeyFormData', () => {
  it('reads label and scopes from form data', () => {
    const formData = new FormData();
    formData.set('label', 'Integration');
    formData.append('scopes', 'admin');
    formData.append('scopes', 'storefront');

    expect(parseCreateApiKeyFormData(formData)).toEqual({
      label: 'Integration',
      scopes: ['admin', 'storefront'],
      expiresAt: null,
    });
  });
});

describe('parseApiKeyListParams', () => {
  it('defaults page and limit', () => {
    expect(parseApiKeyListParams()).toEqual({ page: 1, limit: 20 });
  });

  it('caps limit at MAX_API_KEY_LIST_RESULTS', () => {
    expect(parseApiKeyListParams({ limit: '500' })).toEqual({
      page: 1,
      limit: 100,
    });
  });
});

describe('serializeApiKey', () => {
  it('drops keyHash and parses scopes', () => {
    const serialized = serializeApiKey(makeRecord());
    expect(serialized.keyHash).toBeUndefined();
    expect(serialized.scopes).toEqual(['admin']);
    expect(serialized.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('createApiKey', () => {
  it('returns a raw key and a serialized record without keyHash', async () => {
    const record = makeRecord();
    prisma.apiKey.create.mockResolvedValue(record);

    const { key, record: serialized } = await createApiKey({
      label: 'Test key',
      scopes: ['admin'],
    });

    expect(key).toMatch(/^berm_/);
    expect(key.length).toBeGreaterThan(10);
    expect(serialized.keyHash).toBeUndefined();
    expect(serialized.label).toBe('Test key');
    expect(serialized.scopes).toEqual(['admin']);
    expect(prisma.apiKey.create).toHaveBeenCalledOnce();
  });

  it('throws LABEL_REQUIRED when label is empty', async () => {
    await expect(
      createApiKey({ label: '', scopes: ['admin'] })
    ).rejects.toMatchObject({
      code: 'LABEL_REQUIRED',
    });
    expect(prisma.apiKey.create).not.toHaveBeenCalled();
  });

  it('throws SCOPES_REQUIRED when scopes is empty', async () => {
    await expect(
      createApiKey({ label: 'x', scopes: [] })
    ).rejects.toMatchObject({
      code: 'SCOPES_REQUIRED',
    });
    expect(prisma.apiKey.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('validateApiKey', () => {
  it('returns the serialized record for a valid key', async () => {
    const record = makeRecord();
    prisma.apiKey.findUnique.mockResolvedValue(record);
    prisma.apiKey.update.mockResolvedValue(record);

    const result = await validateApiKey('berm_validkey', ['admin']);

    expect(result.label).toBe('Test key');
    expect(result.scopes).toEqual(['admin']);
    expect(result.keyHash).toBeUndefined();
    expect(prisma.apiKey.findUnique).toHaveBeenCalledOnce();
  });

  it('throws KEY_REQUIRED when key is empty', async () => {
    await expect(validateApiKey('')).rejects.toMatchObject({
      code: 'KEY_REQUIRED',
      status: 401,
    });
    expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it('throws KEY_INVALID for an unknown key', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(validateApiKey('berm_notreal')).rejects.toMatchObject({
      code: 'KEY_INVALID',
      status: 401,
    });
  });

  it('throws INSUFFICIENT_SCOPE when scope not satisfied', async () => {
    const record = makeRecord({ scopes: '["storefront"]' });
    prisma.apiKey.findUnique.mockResolvedValue(record);
    await expect(validateApiKey('berm_key', ['admin'])).rejects.toMatchObject({
      code: 'INSUFFICIENT_SCOPE',
      status: 403,
    });
  });

  it('accepts when required scopes are a subset of key scopes', async () => {
    const record = makeRecord({ scopes: '["admin","storefront"]' });
    prisma.apiKey.findUnique.mockResolvedValue(record);
    prisma.apiKey.update.mockResolvedValue(record);

    const result = await validateApiKey('berm_key', ['admin']);
    expect(result.scopes).toContain('admin');
  });

  it('throws KEY_EXPIRED for an expired key', async () => {
    const past = new Date(Date.now() - 1000);
    const record = makeRecord({ expiresAt: past });
    prisma.apiKey.findUnique.mockResolvedValue(record);
    await expect(validateApiKey('berm_key')).rejects.toMatchObject({
      code: 'KEY_EXPIRED',
      status: 401,
    });
  });
});

// ---------------------------------------------------------------------------

describe('listApiKeys', () => {
  it('returns paginated keys with scopes parsed and keyHash removed', async () => {
    prisma.apiKey.findMany.mockResolvedValue([
      makeRecord({ id: '1', label: 'A', scopes: '["admin"]' }),
      makeRecord({ id: '2', label: 'B', scopes: '["storefront"]' }),
    ]);
    prisma.apiKey.count.mockResolvedValue(2);

    const result = await listApiKeys({ page: 1, limit: 20 });
    expect(result.apiKeys).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    for (const k of result.apiKeys) {
      expect(k.keyHash).toBeUndefined();
      expect(Array.isArray(k.scopes)).toBe(true);
    }
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });
});

// ---------------------------------------------------------------------------

describe('getApiKey', () => {
  it('returns a serialized key', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(makeRecord());
    const result = await getApiKey('key-1');
    expect(result.id).toBe('key-1');
    expect(result.keyHash).toBeUndefined();
  });

  it('throws NOT_FOUND when key is missing', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(getApiKey('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

// ---------------------------------------------------------------------------

describe('revokeApiKey', () => {
  it('deletes an existing key', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(makeRecord());
    prisma.apiKey.delete.mockResolvedValue({});
    await expect(revokeApiKey('key-1')).resolves.toEqual({ revoked: true });
    expect(prisma.apiKey.delete).toHaveBeenCalledWith({
      where: { id: 'key-1' },
    });
  });

  it('throws NOT_FOUND when key is missing', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(revokeApiKey('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(prisma.apiKey.delete).not.toHaveBeenCalled();
  });
});

describe('API_KEY_SCOPES', () => {
  it('includes admin and storefront', () => {
    expect(API_KEY_SCOPES).toEqual(['admin', 'storefront']);
  });
});
