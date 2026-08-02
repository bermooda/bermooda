import '#/libs/auth/test-setup.server';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  adminAuthMiddleware,
  adminAuthHandlerMiddleware,
} from '#/libs/auth/admin/index.server';
import { adminAuthTestState, catchThrown } from '#/libs/auth/test-setup.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';

describe('adminAuthMiddleware', () => {
  beforeEach(() => {
    adminAuthTestState.sessionImpl.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
  });

  it('applies the auth rate limit before checking the session', async () => {
    adminAuthTestState.sessionImpl.mockResolvedValue(null);
    const request = new Request('http://localhost:3000/admin/products');
    const context = { set: vi.fn() };

    await catchThrown(() => adminAuthMiddleware({ request, context }));

    expect(enforceRateLimit).toHaveBeenCalledWith(request, 'auth');
  });

  it('throws a 302 redirect to /admin/login when getSession returns null', async () => {
    adminAuthTestState.sessionImpl.mockResolvedValue(null);
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
    adminAuthTestState.sessionImpl.mockResolvedValue({
      session: {},
      user: null,
    });
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
    adminAuthTestState.sessionImpl.mockResolvedValue(null);
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
      role: 'admin',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    adminAuthTestState.sessionImpl.mockResolvedValue({
      session: { id: 's1' },
      user,
    });
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
      role: 'admin',
    });
  });
});

describe('adminAuthHandlerMiddleware', () => {
  it('throws the admin auth handler response', async () => {
    const request = new Request('http://localhost:3000/admin/auth/get-session');
    const response = Response.json({ session: null });
    const { adminAuth } = await import('#/libs/auth/admin/index.server');
    adminAuth.handler.mockResolvedValue(response);

    const thrown = await catchThrown(() =>
      adminAuthHandlerMiddleware({ request })
    );

    expect(thrown).toBe(response);
    expect(adminAuth.handler).toHaveBeenCalledWith(request);
  });
});

describe('auth isolation', () => {
  it('adminAuth and customerAuth are separate betterAuth instances', async () => {
    const { adminAuth } = await import('#/libs/auth/admin/index.server');
    const { customerAuth } = await import('#/libs/auth/customer/index.server');

    expect(adminAuth).toBeDefined();
    expect(customerAuth).toBeDefined();
    expect(adminAuth).not.toBe(customerAuth);
  });

  it('admin instance uses /admin/auth base path', async () => {
    const { adminAuth } = await import('#/libs/auth/admin/index.server');
    expect(adminAuth._cfg?.basePath).toBe('/admin/auth');
  });

  it('customer instance uses /account/auth base path', async () => {
    const { customerAuth } = await import('#/libs/auth/customer/index.server');
    expect(customerAuth._cfg?.basePath).toBe('/account/auth');
  });
});

describe('sendAdminPasswordResetOrInvite', () => {
  it('queues a staff invite when the user has no credential password', async () => {
    const prisma = (await import('#/libs/prisma.server')).default;
    const { queueStaffInviteEmail, queuePasswordResetEmail } =
      await import('#/emails/job.server');
    const { sendAdminPasswordResetOrInvite } =
      await import('#/libs/auth/admin/index.server');

    prisma.account.findFirst.mockResolvedValue(null);

    const result = await sendAdminPasswordResetOrInvite({
      user: { id: 'u1', email: 'staff@example.com', name: 'Staff' },
      url: 'http://localhost:3000/admin/auth/reset-password/token',
    });

    expect(result).toBe('invite');
    expect(queueStaffInviteEmail).toHaveBeenCalledWith(
      'staff@example.com',
      'Staff',
      'http://localhost:3000/admin/auth/reset-password/token'
    );
    expect(queuePasswordResetEmail).not.toHaveBeenCalled();
  });

  it('queues a password reset when the user already has a password', async () => {
    const prisma = (await import('#/libs/prisma.server')).default;
    const { queueStaffInviteEmail, queuePasswordResetEmail } =
      await import('#/emails/job.server');
    const { sendAdminPasswordResetOrInvite } =
      await import('#/libs/auth/admin/index.server');

    prisma.account.findFirst.mockResolvedValue({ password: 'hashed' });
    queueStaffInviteEmail.mockClear();
    queuePasswordResetEmail.mockClear();

    const result = await sendAdminPasswordResetOrInvite({
      user: { id: 'u1', email: 'admin@example.com', name: 'Admin' },
      url: 'http://localhost:3000/admin/auth/reset-password/token',
    });

    expect(result).toBe('reset');
    expect(queuePasswordResetEmail).toHaveBeenCalledWith(
      'admin@example.com',
      'Admin',
      'http://localhost:3000/admin/auth/reset-password/token',
      { preferCustomerLocale: false }
    );
    expect(queueStaffInviteEmail).not.toHaveBeenCalled();
  });
});
