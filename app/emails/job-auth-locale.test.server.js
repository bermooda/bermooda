import { beforeEach, describe, expect, it, vi } from 'vitest';

const jobState = vi.hoisted(() => ({
  /** @type {Record<string, { add: ReturnType<typeof vi.fn>, process: Function }>} */
  jobs: {},
  resolveAuthEmailLocale: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock('#/libs/config', () => ({
  default: { baseUrl: 'http://localhost:3000' },
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    order: { findUnique: vi.fn() },
  },
}));

vi.mock('#/core/events/index.server', () => ({
  on: vi.fn(),
}));

vi.mock('#/libs/queue.server', () => ({
  default: { id: 'queue' },
  defineQueueJob: vi.fn((name, options) => {
    const add = vi.fn();
    jobState.jobs[name] = { add, process: options.process };
    return { add };
  }),
  createThrottledJob: (fn) => fn,
}));

vi.mock('#/emails/locale.server', () => ({
  resolveAuthEmailLocale: jobState.resolveAuthEmailLocale,
}));

vi.mock('#/emails/index.server', () => ({
  sendPasswordResetEmail: jobState.sendPasswordResetEmail,
  sendStaffInviteEmail: vi.fn(),
  sendTwoFactorOtpEmail: vi.fn(),
  sendVerificationEmail: jobState.sendVerificationEmail,
  sendOrderConfirmationEmail: vi.fn(),
  sendOrderShippedEmail: vi.fn(),
  sendOrderDeliveredEmail: vi.fn(),
  sendOrderRefundedEmail: vi.fn(),
  sendReturnReceivedEmail: vi.fn(),
  sendCustomerWelcomeEmail: vi.fn(),
  sendAbandonedCartEmail: vi.fn(),
}));

describe('auth email queue locale preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobState.jobs = {};
    jobState.resolveAuthEmailLocale.mockResolvedValue('de');
    jobState.sendPasswordResetEmail.mockResolvedValue(undefined);
    jobState.sendVerificationEmail.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it('queues password reset with preferCustomerLocale on the payload', async () => {
    const { queuePasswordResetEmail } = await import('#/emails/job.server');

    queuePasswordResetEmail('a@b.com', 'Ada', 'https://example.com/reset', {
      preferCustomerLocale: true,
    });
    queuePasswordResetEmail(
      'admin@b.com',
      'Admin',
      'https://example.com/reset',
      {
        preferCustomerLocale: false,
      }
    );

    expect(jobState.jobs.password_reset_email.add).toHaveBeenNthCalledWith(1, {
      email: 'a@b.com',
      name: 'Ada',
      url: 'https://example.com/reset',
      preferCustomerLocale: true,
    });
    expect(jobState.jobs.password_reset_email.add).toHaveBeenNthCalledWith(2, {
      email: 'admin@b.com',
      name: 'Admin',
      url: 'https://example.com/reset',
      preferCustomerLocale: false,
    });
  });

  it('defaults preferCustomerLocale to false on queue helpers', async () => {
    const { queuePasswordResetEmail, queueVerifyEmail } =
      await import('#/emails/job.server');

    queuePasswordResetEmail('a@b.com', 'Ada', 'https://example.com/reset');
    queueVerifyEmail('a@b.com', 'Ada', 'https://example.com/verify');

    expect(jobState.jobs.password_reset_email.add).toHaveBeenCalledWith(
      expect.objectContaining({ preferCustomerLocale: false })
    );
    expect(jobState.jobs.verify_email.add).toHaveBeenCalledWith(
      expect.objectContaining({ preferCustomerLocale: false })
    );
  });

  it('password_reset processor uses settings-only when preferCustomerLocale is false', async () => {
    await import('#/emails/job.server');

    await jobState.jobs.password_reset_email.process({
      email: 'admin@example.com',
      name: 'Admin',
      url: 'https://example.com/reset',
      preferCustomerLocale: false,
    });

    expect(jobState.resolveAuthEmailLocale).toHaveBeenCalledWith({
      email: 'admin@example.com',
      preferCustomerLocale: false,
    });
    expect(jobState.sendPasswordResetEmail).toHaveBeenCalledWith({
      email: 'admin@example.com',
      name: 'Admin',
      resetUrl: 'https://example.com/reset',
      locale: 'de',
    });
  });

  it('verify_email processor prefers customer locale when payload flag is true', async () => {
    await import('#/emails/job.server');

    await jobState.jobs.verify_email.process({
      email: 'cust@example.com',
      name: 'Cust',
      url: 'https://example.com/verify',
      preferCustomerLocale: true,
    });

    expect(jobState.resolveAuthEmailLocale).toHaveBeenCalledWith({
      email: 'cust@example.com',
      preferCustomerLocale: true,
    });
  });
});
