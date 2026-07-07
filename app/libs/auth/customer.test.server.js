import '#/libs/auth/test-setup.server';
import { beforeEach, describe, expect, it } from 'vitest';

import logger from '#/utils/logger.server';
import {
  customerAuth,
  customerAuthHandlerMiddleware,
  customerAuthMiddleware,
  getCustomerSession,
} from '#/libs/auth/customer.server';
import {
  catchThrown,
  customerAuthTestState,
} from '#/libs/auth/test-setup.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';
import { emit } from '#/core/events/index.server';

describe('customerAuthMiddleware', () => {
  beforeEach(() => {
    customerAuthTestState.sessionImpl.mockReset();
    vi.mocked(enforceRateLimit).mockReset();
  });

  it('applies the auth rate limit before checking the session', async () => {
    customerAuthTestState.sessionImpl.mockResolvedValue(null);
    const request = new Request('http://localhost:3000/account/orders');
    const context = { set: vi.fn() };

    await catchThrown(() => customerAuthMiddleware({ request, context }));

    expect(enforceRateLimit).toHaveBeenCalledWith(request, 'auth');
  });

  it('throws a 302 redirect to /account/login when getSession returns null', async () => {
    customerAuthTestState.sessionImpl.mockResolvedValue(null);
    const request = new Request('http://localhost:3000/account/orders');
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      customerAuthMiddleware({ request, context })
    );

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(302);
    expect(thrown.headers.get('Location')).toMatch(/^\/account\/login/);
  });

  it('throws a 302 redirect to /account/login when session has no user', async () => {
    customerAuthTestState.sessionImpl.mockResolvedValue({
      session: {},
      user: null,
    });
    const request = new Request('http://localhost:3000/account/profile');
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      customerAuthMiddleware({ request, context })
    );

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(302);
    expect(thrown.headers.get('Location')).toMatch(/^\/account\/login/);
  });

  it('includes returnTo query param in the redirect URL', async () => {
    customerAuthTestState.sessionImpl.mockResolvedValue(null);
    const request = new Request(
      'http://localhost:3000/account/orders?status=pending'
    );
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      customerAuthMiddleware({ request, context })
    );

    const location = thrown.headers.get('Location');
    expect(location).toContain('returnTo=');
    expect(decodeURIComponent(location)).toContain(
      '/account/orders?status=pending'
    );
  });

  it('sets customer data in context when session is valid', async () => {
    const user = {
      id: 'c1',
      email: 'customer@example.com',
      name: 'Test Customer',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    customerAuthTestState.sessionImpl.mockResolvedValue({
      session: { id: 's2' },
      user,
    });
    const request = new Request('http://localhost:3000/account/orders');
    const context = { set: vi.fn() };

    const thrown = await catchThrown(() =>
      customerAuthMiddleware({ request, context })
    );

    expect(thrown).toBeNull();
    expect(context.set).toHaveBeenCalledOnce();
    const [, userData] = context.set.mock.calls[0];
    expect(userData).toMatchObject({
      id: 'c1',
      email: 'customer@example.com',
      name: 'Test Customer',
    });
  });
});

describe('customerAuthHandlerMiddleware', () => {
  it('throws the customer auth handler response', async () => {
    const request = new Request(
      'http://localhost:3000/account/auth/get-session'
    );
    const response = Response.json({ session: null });
    customerAuth.handler.mockResolvedValue(response);

    const thrown = await catchThrown(() =>
      customerAuthHandlerMiddleware({ request })
    );

    expect(thrown).toBe(response);
    expect(customerAuth.handler).toHaveBeenCalledWith(request);
  });
});

describe('customerAuth database hooks', () => {
  it('emits customer.registered after a new customer is created', async () => {
    const hook = customerAuth._cfg.databaseHooks.user.create.after;

    await hook({
      id: 'cust_1',
      email: 'new@example.com',
      name: 'New Customer',
    });

    expect(emit).toHaveBeenCalledWith('customer.registered', {
      customerId: 'cust_1',
      email: 'new@example.com',
      name: 'New Customer',
    });
  });
});

describe('getCustomerSession', () => {
  it('logs through the shared logger when getSession throws', async () => {
    customerAuthTestState.sessionImpl.mockRejectedValue(
      new Error('session boom')
    );

    const session = await getCustomerSession(
      new Request('http://localhost:3000/account')
    );

    expect(session).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});
