// app/core/auth/email-ready.test.server.js

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveProviderId = vi.fn();

vi.mock('#/libs/config', () => ({
  default: {
    email: { fromNoReply: 'shop <noreply@example.com>' },
  },
}));

vi.mock('#/libs/email/index.server', () => ({
  getActiveProviderId: (...args) => getActiveProviderId(...args),
}));

import config from '#/libs/config';
import { isAdminEmailReady } from '#/core/auth/email-ready.server';

describe('isAdminEmailReady', () => {
  beforeEach(() => {
    getActiveProviderId.mockReset();
    config.email.fromNoReply = 'shop <noreply@example.com>';
  });

  it('is false when fromNoReply is empty', () => {
    config.email.fromNoReply = '  ';
    getActiveProviderId.mockReturnValue('resend');
    expect(isAdminEmailReady()).toBe(false);
  });

  it('is false when no email provider is active', () => {
    getActiveProviderId.mockReturnValue(null);
    expect(isAdminEmailReady()).toBe(false);
  });

  it('is true when from address and provider are set', () => {
    getActiveProviderId.mockReturnValue('resend');
    expect(isAdminEmailReady()).toBe(true);
  });
});
