import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendErrorAlert } = vi.hoisted(() => ({
  sendErrorAlert: vi.fn(async () => true),
}));

vi.mock('#/utils/logger.server', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('#/libs/alerting/index.server', () => ({
  sendErrorAlert,
  SEVERITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}));

import { handleError } from '#/libs/error/index.server';

describe('error.server handleError', () => {
  beforeEach(() => {
    sendErrorAlert.mockClear();
  });

  it('logs, alerts, and returns a data response with the resolved message', () => {
    const error = new Error('Database unavailable');
    const response = handleError(error, {
      source: 'admin.import',
      userMessage: 'Import failed',
      status: 500,
    });

    expect(sendErrorAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Database unavailable',
        source: 'admin.import',
        severity: 'high',
        stack: error.stack,
      })
    );
    expect(response.init?.status).toBe(500);
    expect(response.data).toEqual({
      error: 'Import failed',
      success: false,
    });
  });

  it('uses an explicit message when provided', () => {
    handleError(new Error('Original'), {
      message: 'Job failed',
      source: 'queue.server',
    });

    expect(sendErrorAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Job failed',
        source: 'queue.server',
      })
    );
  });
});
