import { describe, expect, it } from 'vitest';

import {
  ADMIN_API_SCOPES,
  API_KEY_SCOPES,
  apiKeyCanAccessAdminApi,
  apiKeySatisfiesScope,
} from './scopes';

describe('apiKeySatisfiesScope', () => {
  it('matches exact scope', () => {
    expect(apiKeySatisfiesScope(['products:read'], 'products:read')).toBe(true);
  });

  it('lets admin satisfy granular admin scopes', () => {
    expect(apiKeySatisfiesScope(['admin'], 'orders:write')).toBe(true);
    expect(apiKeySatisfiesScope(['admin'], 'media:read')).toBe(true);
  });

  it('does not let admin satisfy storefront', () => {
    expect(apiKeySatisfiesScope(['admin'], 'storefront')).toBe(false);
  });

  it('rejects missing scopes', () => {
    expect(apiKeySatisfiesScope(['products:read'], 'products:write')).toBe(
      false
    );
  });
});

describe('apiKeyCanAccessAdminApi', () => {
  it('allows admin and granular scopes', () => {
    expect(apiKeyCanAccessAdminApi(['admin'])).toBe(true);
    expect(apiKeyCanAccessAdminApi(['audit:read'])).toBe(true);
  });

  it('rejects storefront-only keys', () => {
    expect(apiKeyCanAccessAdminApi(['storefront'])).toBe(false);
  });
});

describe('API_KEY_SCOPES', () => {
  it('includes admin, storefront, and granular scopes', () => {
    expect(API_KEY_SCOPES).toContain('admin');
    expect(API_KEY_SCOPES).toContain('storefront');
    expect(API_KEY_SCOPES).toContain('products:write');
    expect(ADMIN_API_SCOPES).not.toContain('storefront');
  });
});
