import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const resendSend = vi.fn(async () => ({ success: true, id: 're_1' }));
const sendgridSend = vi.fn(async () => ({ success: true, id: 'sg_1' }));
const sesSend = vi.fn(async () => ({ success: true, id: 'ses_1' }));

vi.mock('#/libs/email/resend.server', () => ({
  createResendEmailProvider: vi.fn(() => ({
    id: 'resend',
    name: 'Resend',
    send: resendSend,
  })),
}));

vi.mock('#/libs/email/sendgrid.server', () => ({
  createSendGridEmailProvider: vi.fn(() => ({
    id: 'sendgrid',
    name: 'SendGrid',
    send: sendgridSend,
  })),
}));

vi.mock('#/libs/email/ses.server', () => ({
  createSesEmailProvider: vi.fn(() => ({
    id: 'ses',
    name: 'Amazon SES',
    send: sesSend,
  })),
}));

import {
  __resetEmailRegistry,
  DEFAULT_EMAIL_PROVIDER,
  getActiveProvider,
  getConfiguredProviderId,
  hasProvider,
  listProvidersWithDetails,
  registerProvider,
  resolveEmailProvider,
  sendEmail,
  unregisterProvider,
} from '#/libs/email/index.server';

const sampleMessage = {
  from: 'Shop <noreply@example.com>',
  to: 'buyer@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
};

describe('email registry', () => {
  beforeEach(() => {
    __resetEmailRegistry();
    resendSend.mockClear();
    sendgridSend.mockClear();
    sesSend.mockClear();
    delete process.env.EMAIL_PROVIDER;
  });

  it('registers built-in providers by default', () => {
    getActiveProvider();

    expect(listProvidersWithDetails()).toEqual([
      { id: 'resend', name: 'Resend' },
      { id: 'sendgrid', name: 'SendGrid' },
      { id: 'ses', name: 'Amazon SES' },
    ]);
    expect(DEFAULT_EMAIL_PROVIDER).toBe('resend');
  });

  it('defaults to resend when EMAIL_PROVIDER is unset', async () => {
    expect(getConfiguredProviderId()).toBe('resend');

    const result = await sendEmail(sampleMessage);

    expect(result.success).toBe(true);
    expect(resendSend).toHaveBeenCalledWith(sampleMessage);
    expect(sendgridSend).not.toHaveBeenCalled();
  });

  it('routes through EMAIL_PROVIDER when set', async () => {
    process.env.EMAIL_PROVIDER = 'sendgrid';

    await sendEmail(sampleMessage);

    expect(sendgridSend).toHaveBeenCalledOnce();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('allows an explicit providerId override', async () => {
    process.env.EMAIL_PROVIDER = 'resend';

    await sendEmail(sampleMessage, { providerId: 'ses' });

    expect(sesSend).toHaveBeenCalledOnce();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('registers and unregisters custom providers', async () => {
    const customSend = vi.fn(async () => ({ success: true, id: 'custom_1' }));

    registerProvider('postmark', {
      id: 'postmark',
      name: 'Postmark',
      send: customSend,
    });

    expect(hasProvider('postmark')).toBe(true);
    expect(resolveEmailProvider('postmark')).toBe('postmark');

    await sendEmail(sampleMessage, { providerId: 'postmark' });
    expect(customSend).toHaveBeenCalledOnce();

    unregisterProvider('postmark');
    expect(hasProvider('postmark')).toBe(false);
    expect(() => resolveEmailProvider('postmark')).toThrow(/postmark/);
  });

  it('rejects invalid messages and unknown providers', async () => {
    await expect(sendEmail(/** @type {any} */ (null))).rejects.toThrow(
      /message/
    );
    await expect(
      sendEmail(/** @type {any} */ ({ from: 'a', to: 'b', subject: 'c' }))
    ).rejects.toThrow(/html/);
    await expect(
      sendEmail(sampleMessage, { providerId: 'missing' })
    ).rejects.toThrow(/missing/);
  });
});
