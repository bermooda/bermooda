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
const telegramSendMessage = vi.fn(async () => true);

vi.mock('#/libs/alerting/telegram.server', () => ({
  createTelegramAlertProvider: vi.fn(() => ({
    id: 'telegram',
    name: 'Telegram',
    sendError: telegramSendError,
    sendMessage: telegramSendMessage,
  })),
}));

import {
  __resetAlertingRegistry,
  getActiveProvider,
  listProvidersWithDetails,
  registerProvider,
  sendAlertMessage,
  sendErrorAlert,
} from '#/libs/alerting/index.server';

describe('alerting.server', () => {
  beforeEach(() => {
    __resetAlertingRegistry();
    telegramSendError.mockClear();
    telegramSendMessage.mockClear();
    delete process.env.ERROR_ALERT_PROVIDER;
    delete process.env.ERROR_ALERTS_ENABLED;
    process.env.NODE_ENV = 'production';
  });

  it('registers the telegram provider by default', () => {
    getActiveProvider();

    expect(listProvidersWithDetails()).toEqual([
      { id: 'telegram', name: 'Telegram' },
    ]);
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

  it('sends messages through the configured provider', async () => {
    const result = await sendAlertMessage('Order completed', {
      headline: 'INFO',
      metadata: { orderId: '123' },
    });

    expect(result).toBe(true);
    expect(telegramSendMessage).toHaveBeenCalledWith('Order completed', {
      headline: 'INFO',
      metadata: { orderId: '123' },
    });
  });

  it('uses a custom provider for messages when registered', async () => {
    const customSendMessage = vi.fn(async () => true);

    registerProvider('custom', {
      id: 'custom',
      sendError: vi.fn(async () => true),
      sendMessage: customSendMessage,
    });

    process.env.ERROR_ALERT_PROVIDER = 'custom';

    const result = await sendAlertMessage('Custom message');

    expect(result).toBe(true);
    expect(customSendMessage).toHaveBeenCalledWith('Custom message', {});
    expect(telegramSendMessage).not.toHaveBeenCalled();
  });

  it('returns false when the active provider has no sendMessage', async () => {
    registerProvider('errors-only', {
      id: 'errors-only',
      sendError: vi.fn(async () => true),
    });

    process.env.ERROR_ALERT_PROVIDER = 'errors-only';

    const result = await sendAlertMessage('No message handler');

    expect(result).toBe(false);
    expect(telegramSendMessage).not.toHaveBeenCalled();
  });

  it('skips messages in development', async () => {
    process.env.NODE_ENV = 'development';

    const result = await sendAlertMessage('Dev message');

    expect(result).toBe(true);
    expect(telegramSendMessage).not.toHaveBeenCalled();
  });

  it('skips messages when globally disabled', async () => {
    process.env.ERROR_ALERTS_ENABLED = 'false';

    const result = await sendAlertMessage('Disabled message');

    expect(result).toBe(false);
    expect(telegramSendMessage).not.toHaveBeenCalled();
  });
});
