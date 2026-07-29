import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('resend', () => {
  class ResendMock {
    /** @param {string} apiKey */
    constructor(apiKey) {
      this.apiKey = apiKey;
      this.emails = {
        send: vi.fn(async () => ({ data: { id: 're_abc' }, error: null })),
      };
    }
  }

  return { Resend: ResendMock };
});

vi.mock('@aws-sdk/client-ses', () => {
  class SendEmailCommand {
    /** @param {unknown} input */
    constructor(input) {
      this.input = input;
    }
  }

  class SESClient {
    /** @param {unknown} config */
    constructor(config) {
      this.config = config;
      this.send = vi.fn(async () => ({ MessageId: 'ses_abc' }));
    }
  }

  return { SESClient, SendEmailCommand };
});

const { getPluginSettingSecret, getPluginSettingValue } = vi.hoisted(() => ({
  getPluginSettingSecret: vi.fn(),
  getPluginSettingValue: vi.fn(),
}));

vi.mock('#/core/plugins/settings.server', () => ({
  getPluginSettingSecret,
  getPluginSettingValue,
}));

import { createResendEmailProvider } from '#/test/fixtures/email-providers/resend.server';
import { createSendGridEmailProvider } from '#/test/fixtures/email-providers/sendgrid.server';
import { createSesEmailProvider } from '#/test/fixtures/email-providers/ses.server';

const sampleMessage = {
  from: 'Shop <noreply@example.com>',
  to: 'buyer@example.com',
  subject: 'Hello',
  html: '<p>Hi</p>',
  text: 'Hi',
};

describe('email provider adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPluginSettingSecret.mockResolvedValue(null);
    getPluginSettingValue.mockResolvedValue(null);
    vi.unstubAllGlobals();
  });

  it('sends via Resend when API key is set', async () => {
    getPluginSettingSecret.mockResolvedValue('re_test');
    const provider = createResendEmailProvider();
    const result = await provider.send(sampleMessage);

    expect(result.success).toBe(true);
    expect(result.id).toBe('re_abc');
    expect(getPluginSettingSecret).toHaveBeenCalledWith(
      '@bermooda/plugin-resend',
      'apiKey'
    );
  });

  it('throws when Resend is not configured', async () => {
    const provider = createResendEmailProvider();
    await expect(provider.send(sampleMessage)).rejects.toThrow(
      /Admin → Plugins → Resend/
    );
  });

  it('sends via SendGrid HTTP API', async () => {
    getPluginSettingSecret.mockResolvedValue('sg_test');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 202,
      headers: { get: () => 'sg_msg_1' },
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createSendGridEmailProvider();
    const result = await provider.send(sampleMessage);

    expect(result.success).toBe(true);
    expect(result.id).toBe('sg_msg_1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sg_test',
        }),
      })
    );
  });

  it('throws when SendGrid is not configured', async () => {
    const provider = createSendGridEmailProvider();
    await expect(provider.send(sampleMessage)).rejects.toThrow(
      /Admin → Plugins → SendGrid/
    );
  });

  it('sends via Amazon SES', async () => {
    getPluginSettingValue.mockResolvedValue('eu-west-1');
    getPluginSettingSecret.mockImplementation(async (_id, key) => {
      if (key === 'accessKeyId') return 'AKIA';
      if (key === 'secretAccessKey') return 'secret';
      return null;
    });

    const provider = createSesEmailProvider();
    const result = await provider.send(sampleMessage);

    expect(result.success).toBe(true);
    expect(result.id).toBe('ses_abc');
  });

  it('throws when SES credentials are missing', async () => {
    const provider = createSesEmailProvider();
    await expect(provider.send(sampleMessage)).rejects.toThrow(
      /Admin → Plugins → Amazon SES/
    );
  });
});
