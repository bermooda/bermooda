import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const telegramSendError = vi.fn(async () => true);

vi.mock('#/libs/alerting/telegram.server', () => ({
  createTelegramAlertProvider: vi.fn(() => ({
    id: 'telegram',
    name: 'Telegram',
    sendError: telegramSendError,
  })),
}));

import {
  __resetAlertingRegistry,
  getActiveProvider,
  listProviders,
  registerProvider,
  sendErrorAlert,
} from '#/libs/alerting.server';

describe('alerting.server', () => {
  beforeEach(() => {
    __resetAlertingRegistry();
    telegramSendError.mockClear();
    delete process.env.ERROR_ALERT_PROVIDER;
    delete process.env.ERROR_ALERTS_ENABLED;
    process.env.NODE_ENV = 'production';
  });

  it('registers the telegram provider by default', () => {
    getActiveProvider();

    expect(listProviders()).toEqual(['telegram']);
  });

  it('sends alerts through the configured provider', async () => {
    const result = await sendErrorAlert({
      message: 'Something failed',
      source: 'test',
    });

    expect(result).toBe(true);
    expect(telegramSendError).toHaveBeenCalledWith(
      {
        message: 'Something failed',
        source: 'test',
      },
      {}
    );
  });

  it('uses a custom provider when registered', async () => {
    const customSendError = vi.fn(async () => true);

    registerProvider('custom', {
      id: 'custom',
      sendError: customSendError,
    });

    process.env.ERROR_ALERT_PROVIDER = 'custom';

    const result = await sendErrorAlert({ message: 'Custom alert' });

    expect(result).toBe(true);
    expect(customSendError).toHaveBeenCalledWith(
      { message: 'Custom alert' },
      {}
    );
    expect(telegramSendError).not.toHaveBeenCalled();
  });

  it('skips alerts in development', async () => {
    process.env.NODE_ENV = 'development';

    const result = await sendErrorAlert({ message: 'Dev error' });

    expect(result).toBe(true);
    expect(telegramSendError).not.toHaveBeenCalled();
  });

  it('skips alerts when globally disabled', async () => {
    process.env.ERROR_ALERTS_ENABLED = 'false';

    const result = await sendErrorAlert({ message: 'Disabled error' });

    expect(result).toBe(false);
    expect(telegramSendError).not.toHaveBeenCalled();
  });
});
