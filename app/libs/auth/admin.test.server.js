// app/libs/auth/admin.test.server.js
// Tests for admin auth route middleware redirect behavior and admin auth instance config.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be registered before imports (vi.mock calls are hoisted)
// ---------------------------------------------------------------------------

// Shared state object — the betterAuth factory closes over this, so any
// test can swap out which fn is called by mutating `sessionImpl`.
const adminState = { sessionImpl: vi.fn() };
const customerState = { sessionImpl: vi.fn() };

vi.mock('os', () => ({
  networkInterfaces: vi.fn(() => ({})),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pw) => `hashed:${pw}`),
    compare: vi.fn(async () => true),
  },
}));

// betterAuth factory routes getSession to adminState or customerState by basePath
// so tests can control behavior without module re-registration.
vi.mock('better-auth', () => ({
  betterAuth: vi.fn((cfg) => {
    // Identify admin vs customer instance by basePath in config.
    // Both share the same factory — we key on which state bag to use via
    // a simple heuristic: if the basePath contains "admin" use adminState.
    const isAdmin = cfg?.basePath?.includes('admin');
    return {
      _cfg: cfg,
      api: {
        getSession: (...args) =>
          isAdmin
            ? adminState.sessionImpl(...args)
            : customerState.sessionImpl(...args),
      },
      handler: vi.fn(),
    };
  }),
}));

vi.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: vi.fn(() => ({})),
}));

vi.mock('better-auth/plugins', () => ({
  twoFactor: vi.fn(() => ({})),
  admin: vi.fn(() => ({})),
}));

vi.mock('better-auth/api', () => ({
  createAuthMiddleware: vi.fn(() => vi.fn()),
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    user: { findFirst: vi.fn() },
    session: { findFirst: vi.fn() },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock('#/emails/job.server', () => ({
  queuePasswordResetEmail: vi.fn(),
  queueTwoFactorOtp: vi.fn(),
  queueVerifyEmail: vi.fn(),
  queueCustomerWelcomeEmail: vi.fn(),
}));

vi.mock('#/config', () => ({
  default: {
    appName: 'bermooda',
    baseUrl: 'http://localhost:3000',
    auth: {
      adminBasePath: '/admin/auth',
      adminCallbackUrl: '/admin/dashboard',
      adminCookiePrefix: 'bermooda_admin_',
      customerBasePath: '/account/auth',
      customerCallbackUrl: '/account',
      customerCookiePrefix: 'bermooda_customer_',
    },
  },
}));

// react-router's redirect() returns a Response with a Location header.
// The middleware *throws* that response, so we replicate the real shape.
vi.mock('react-router', () => ({
  createContext: vi.fn(() => ({})),
  redirect: vi.fn(
    (url, status = 302) =>
      new Response(null, { status, headers: { Location: url } })
  ),
}));

// ---------------------------------------------------------------------------
// Import modules under test (after all mocks are registered)
// ---------------------------------------------------------------------------

import { adminAuthMiddleware } from './admin.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run middleware and return the thrown value (or null if it resolves). */
async function catchThrown(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

// ---------------------------------------------------------------------------
// Admin auth middleware
// ---------------------------------------------------------------------------

describe('adminAuthMiddleware', () => {
  beforeEach(() => {
    adminState.sessionImpl.mockReset();
  });

  it('throws a 302 redirect to /admin/login when getSession returns null', async () => {
    adminState.sessionImpl.mockResolvedValue(null);
    const request = new Request('http://localhost:3000/admin/products');
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      adminAuthMiddleware({ request, context })
    );

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(302);
    expect(thrown.headers.get('Location')).toMatch(/^\/admin\/login/);
  });

  it('throws a 302 redirect to /admin/login when session has no user', async () => {
    adminState.sessionImpl.mockResolvedValue({ session: {}, user: null });
    const request = new Request('http://localhost:3000/admin/products');
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      adminAuthMiddleware({ request, context })
    );

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(302);
    expect(thrown.headers.get('Location')).toMatch(/^\/admin\/login/);
  });

  it('includes returnTo query param in the redirect URL', async () => {
    adminState.sessionImpl.mockResolvedValue(null);
    const request = new Request('http://localhost:3000/admin/products?page=2');
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      adminAuthMiddleware({ request, context })
    );

    const location = thrown.headers.get('Location');
    expect(location).toContain('returnTo=');
    expect(decodeURIComponent(location)).toContain('/admin/products?page=2');
  });

  it('sets user data in context when session is valid', async () => {
    const user = {
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin User',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    adminState.sessionImpl.mockResolvedValue({ session: { id: 's1' }, user });
    const request = new Request('http://localhost:3000/admin/products');
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      adminAuthMiddleware({ request, context })
    );

    expect(thrown).toBeNull();
    expect(context.set).toHaveBeenCalledOnce();
    const [, userData] = context.set.mock.calls[0];
    expect(userData).toMatchObject({
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin User',
    });
  });
});

// ---------------------------------------------------------------------------
// Auth isolation — admin and customer are separate instances
// ---------------------------------------------------------------------------

describe('auth isolation', () => {
  it('adminAuth and customerAuth are separate betterAuth instances', async () => {
    const { adminAuth } = await import('./admin.server');
    const { customerAuth } = await import('./customer.server');

    expect(adminAuth).toBeDefined();
    expect(customerAuth).toBeDefined();
    expect(adminAuth).not.toBe(customerAuth);
  });

  it('admin instance uses /admin/auth base path', async () => {
    const { adminAuth } = await import('./admin.server');
    expect(adminAuth._cfg?.basePath).toBe('/admin/auth');
  });

  it('customer instance uses /account/auth base path', async () => {
    const { customerAuth } = await import('./customer.server');
    expect(customerAuth._cfg?.basePath).toBe('/account/auth');
  });
});
