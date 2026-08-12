import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('#/libs/email/nodemailer.server', () => ({
  createNodemailerEmailProvider: () => ({
    id: 'nodemailer',
    name: 'Nodemailer (SMTP)',
    send: vi.fn(async () => ({ success: true, id: 'nm_1' })),
  }),
}));

import {
  __resetEmailRegistry,
  getActiveProvider,
  getActiveProviderId,
  hasProvider,
  listProvidersWithDetails,
  registerProvider,
  resolveEmailProvider,
  sendEmail,
  setActiveProvider,
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
  });

  it('registers the built-in Nodemailer provider by default', async () => {
    expect(getActiveProviderId()).toBe('nodemailer');
    expect(hasProvider('nodemailer')).toBe(true);
    expect(listProvidersWithDetails()).toEqual([
      { id: 'nodemailer', name: 'Nodemailer (SMTP)' },
    ]);

    const result = await sendEmail(sampleMessage);
    expect(result.success).toBe(true);
    expect(result.id).toBe('nm_1');
  });

  it('lets an email plugin take over as the active provider', async () => {
    const send = vi.fn(async () => ({ success: true, id: '1' }));
    // Ensure builtin is registered first (as at runtime).
    expect(getActiveProviderId()).toBe('nodemailer');

    registerProvider('resend', { id: 'resend', name: 'Resend', send }, {
      isActive: true,
    });

    expect(getActiveProviderId()).toBe('resend');
    await sendEmail(sampleMessage);
    expect(send).toHaveBeenCalledWith(sampleMessage);
  });

  it('supports explicit providerId and setActiveProvider', async () => {
    const resendSend = vi.fn(async () => ({ success: true }));
    const sendgridSend = vi.fn(async () => ({ success: true }));

    registerProvider('resend', {
      id: 'resend',
      name: 'Resend',
      send: resendSend,
    });
    registerProvider('sendgrid', {
      id: 'sendgrid',
      name: 'SendGrid',
      send: sendgridSend,
    });

    setActiveProvider('sendgrid');
    await sendEmail(sampleMessage);
    expect(sendgridSend).toHaveBeenCalledOnce();
    expect(resendSend).not.toHaveBeenCalled();

    await sendEmail(sampleMessage, { providerId: 'resend' });
    expect(resendSend).toHaveBeenCalledOnce();
  });

  it('unregisters providers and falls back to another active id', () => {
    expect(getActiveProviderId()).toBe('nodemailer');

    registerProvider(
      'sendgrid',
      { id: 'sendgrid', name: 'SendGrid', send: vi.fn() },
      { isActive: true }
    );

    expect(getActiveProviderId()).toBe('sendgrid');
    unregisterProvider('sendgrid');
    expect(hasProvider('sendgrid')).toBe(false);
    expect(getActiveProviderId()).toBe('nodemailer');
    expect(() => resolveEmailProvider('sendgrid')).toThrow(/sendgrid/);
  });

  it('rejects invalid messages', async () => {
    expect(getActiveProvider().id).toBe('nodemailer');

    await expect(sendEmail(/** @type {any} */ (null))).rejects.toThrow(
      /message/
    );
    await expect(
      sendEmail(/** @type {any} */ ({ from: 'a', to: 'b', subject: 'c' }))
    ).rejects.toThrow(/html/);
  });
});
