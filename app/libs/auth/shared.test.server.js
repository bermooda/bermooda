import '#/libs/auth/test-setup.server';
import { describe, expect, it } from 'vitest';

import {
  buildLoginRedirectUrl,
  getLocalNetworkUrl,
  getTrustedOrigins,
  pickAuthUserContextFields,
} from '#/libs/auth/shared.server';

describe('getLocalNetworkUrl', () => {
  it('returns null when no external IPv4 interfaces are available', () => {
    expect(getLocalNetworkUrl()).toBeNull();
  });
});

describe('getTrustedOrigins', () => {
  it('includes the configured base URL', () => {
    expect(getTrustedOrigins()).toContain('http://localhost:3000');
  });
});

describe('buildLoginRedirectUrl', () => {
  it('preserves the current path and query string as returnTo', () => {
    const request = new Request(
      'http://localhost:3000/account/orders?status=pending'
    );

    const url = buildLoginRedirectUrl('/account/login', request);

    expect(url).toContain('returnTo=');
    expect(decodeURIComponent(url)).toContain('/account/orders?status=pending');
  });

  it('accepts a raw URL string', () => {
    const url = buildLoginRedirectUrl(
      '/admin/login',
      'http://localhost:3000/admin/products?page=2'
    );

    expect(decodeURIComponent(url)).toContain('/admin/products?page=2');
  });
});

describe('pickAuthUserContextFields', () => {
  it('returns the fields stored in auth middleware context', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    expect(
      pickAuthUserContextFields({
        id: 'u1',
        email: 'user@example.com',
        name: 'User',
        emailVerified: true,
        createdAt,
        updatedAt,
        role: 'admin',
      })
    ).toEqual({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      emailVerified: true,
      createdAt,
      updatedAt,
    });
  });
});
