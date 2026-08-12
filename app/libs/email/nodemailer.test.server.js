import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMail = vi.fn(async () => ({ messageId: 'nm_abc' }));
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (...args) => createTransport(...args),
  },
}));

vi.mock('#/libs/config', () => ({
  default: {
    email: {
      fromNoReply: 'Shop <noreply@example.com>',
      smtp: undefined,
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import config from '#/libs/config';
import {
  __resetNodemailerTransporter,
  createNodemailerEmailProvider,
  resolveNodemailerTransportOptions,
} from '#/libs/email/nodemailer.server';

const sampleMessage = {
  from: 'Shop <noreply@example.com>',
  to: 'buyer@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
  replyTo: 'support@example.com',
  headers: { 'X-Test': '1' },
};

describe('resolveNodemailerTransportOptions', () => {
  it('returns empty object when smtp is unset', () => {
    expect(resolveNodemailerTransportOptions(undefined)).toEqual({});
    expect(resolveNodemailerTransportOptions(null)).toEqual({});
    expect(resolveNodemailerTransportOptions('')).toEqual({});
  });

  it('passes through object and trimmed URL string configs', () => {
    const smtp = { host: 'smtp.example.com', port: 587 };
    expect(resolveNodemailerTransportOptions(smtp)).toBe(smtp);
    expect(
      resolveNodemailerTransportOptions('  smtps://user:pass@smtp.example.com ')
    ).toBe('smtps://user:pass@smtp.example.com');
  });
});

describe('createNodemailerEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetNodemailerTransporter();
    config.email.smtp = undefined;
  });

  it('sends via Nodemailer with default transport options', async () => {
    const provider = createNodemailerEmailProvider();
    const result = await provider.send(sampleMessage);

    expect(createTransport).toHaveBeenCalledWith({});
    expect(sendMail).toHaveBeenCalledWith({
      from: sampleMessage.from,
      to: sampleMessage.to,
      subject: sampleMessage.subject,
      html: sampleMessage.html,
      text: sampleMessage.text,
      replyTo: sampleMessage.replyTo,
      headers: sampleMessage.headers,
    });
    expect(result).toEqual({
      success: true,
      data: { messageId: 'nm_abc' },
      id: 'nm_abc',
    });
  });

  it('uses bermooda.config email.smtp when set', async () => {
    config.email.smtp = {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'u', pass: 'p' },
    };

    const provider = createNodemailerEmailProvider();
    await provider.send(sampleMessage);

    expect(createTransport).toHaveBeenCalledWith(config.email.smtp);
  });

  it('reuses the transporter across sends', async () => {
    const provider = createNodemailerEmailProvider();
    await provider.send(sampleMessage);
    await provider.send(sampleMessage);
    expect(createTransport).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
