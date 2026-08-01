import { vi } from 'vitest';

export const adminAuthTestState = { sessionImpl: vi.fn() };
export const customerAuthTestState = { sessionImpl: vi.fn() };

vi.mock('os', () => ({
  networkInterfaces: vi.fn(() => ({})),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (pw) => `hashed:${pw}`),
    compare: vi.fn(async () => true),
  },
}));

vi.mock('better-auth', () => ({
  betterAuth: vi.fn((cfg) => {
    const isAdmin = cfg?.basePath?.includes('admin');
    return {
      _cfg: cfg,
      api: {
        getSession: (...args) =>
          isAdmin
            ? adminAuthTestState.sessionImpl(...args)
            : customerAuthTestState.sessionImpl(...args),
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
  createAuthMiddleware: vi.fn((fn) => fn),
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    user: { findFirst: vi.fn() },
    session: { findFirst: vi.fn() },
    account: { findFirst: vi.fn() },
  },
}));

vi.mock('#/libs/rate-limit.server', () => ({
  enforceRateLimit: vi.fn(),
  rateLimitMiddleware: vi.fn((policy) => {
    return async function rateLimitMiddlewareHandler({ request }, next) {
      const { enforceRateLimit } = await import('#/libs/rate-limit.server');
      enforceRateLimit(request, policy);
      return next();
    };
  }),
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
  queueStaffInviteEmail: vi.fn(),
  queueTwoFactorOtp: vi.fn(),
  queueVerifyEmail: vi.fn(),
  queueCustomerWelcomeEmail: vi.fn(),
}));

vi.mock('#/core/events/index.server', () => ({
  emit: vi.fn(),
}));

vi.mock('#/libs/config', () => ({
  PLATFORM_NAME: 'bermooda',
  resolveDevPort: () => 3000,
  default: {
    baseUrl: 'http://localhost:3000',
    auth: {
      adminBasePath: '/admin/auth',
      adminCallbackUrl: '/admin/dashboard',
      adminCookiePrefix: 'bermooda_admin_',
      customerBasePath: '/account/auth',
      customerCallbackUrl: '/account',
      customerCookiePrefix: 'bermooda_customer_',
    },
    email: {
      fromNoReply: 'bermooda <noreply@example.com>',
    },
  },
}));

vi.mock('react-router', () => ({
  createContext: vi.fn(() => ({})),
  redirect: vi.fn(
    (url, status = 302) =>
      new Response(null, { status, headers: { Location: url } })
  ),
}));

/** Run middleware and return the thrown value (or null if it resolves). */
export async function catchThrown(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}
