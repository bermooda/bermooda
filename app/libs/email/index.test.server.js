import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
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

  it('requires an enabled provider before send', async () => {
    expect(() => getActiveProvider()).toThrow(/No email provider is active/);
    await expect(sendEmail(sampleMessage)).rejects.toThrow(
      /No email provider is active/
    );
  });

  it('activates the first registered provider', async () => {
    const send = vi.fn(async () => ({ success: true, id: '1' }));
    registerProvider('resend', { id: 'resend', name: 'Resend', send });

    expect(getActiveProviderId()).toBe('resend');
    expect(listProvidersWithDetails()).toEqual([
      { id: 'resend', name: 'Resend' },
    ]);

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
    registerProvider('resend', {
      id: 'resend',
      name: 'Resend',
      send: vi.fn(),
    });
    registerProvider(
      'sendgrid',
      { id: 'sendgrid', name: 'SendGrid', send: vi.fn() },
      { isActive: true }
    );

    expect(getActiveProviderId()).toBe('sendgrid');
    unregisterProvider('sendgrid');
    expect(hasProvider('sendgrid')).toBe(false);
    expect(getActiveProviderId()).toBe('resend');
    expect(() => resolveEmailProvider('sendgrid')).toThrow(/sendgrid/);
  });

  it('rejects invalid messages', async () => {
    registerProvider('resend', {
      id: 'resend',
      name: 'Resend',
      send: vi.fn(async () => ({ success: true })),
    });

    await expect(sendEmail(/** @type {any} */ (null))).rejects.toThrow(
      /message/
    );
    await expect(
      sendEmail(/** @type {any} */ ({ from: 'a', to: 'b', subject: 'c' }))
    ).rejects.toThrow(/html/);
  });
});
