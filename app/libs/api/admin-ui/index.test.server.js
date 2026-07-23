import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: { error: vi.fn() },
}));

vi.mock('#/libs/alerting/index.server', () => ({
  sendErrorAlert: vi.fn(),
}));

import logger from '#/utils/logger.server';
import { sendErrorAlert } from '#/libs/alerting/index.server';
import {
  handleAdminActionError,
  parseAdminSearchParams,
  parseAdminUiPagination,
} from '#/libs/api/admin-ui/index.server';

describe('admin-ui helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseAdminUiPagination normalizes page and limit', () => {
    const params = new URLSearchParams('page=2&limit=50');
    expect(parseAdminUiPagination(params, { limit: 20 })).toEqual({
      page: 2,
      limit: 50,
    });
  });

  it('parseAdminSearchParams includes q and status', () => {
    const params = new URLSearchParams('page=1&q=alice&status=paid');
    expect(parseAdminSearchParams(params)).toEqual({
      page: 1,
      limit: 20,
      q: 'alice',
      status: 'paid',
    });
  });

  it('handleAdminActionError maps known codes', () => {
    const err = new Error('Duplicate');
    err.code = 'P2002';

    expect(
      handleAdminActionError(err, {
        source: 'admin.test',
        intent: 'save',
      })
    ).toEqual({
      ok: false,
      error: 'A record with that value already exists.',
      intent: 'save',
    });
    expect(logger.error).not.toHaveBeenCalled();
    expect(sendErrorAlert).not.toHaveBeenCalled();
  });

  it('handleAdminActionError logs and alerts on unknown errors', () => {
    const err = new Error('Database unavailable');

    expect(
      handleAdminActionError(err, {
        source: 'admin.test',
        userMessage: 'Something failed.',
        shape: 'error',
      })
    ).toEqual({ error: 'Something failed.' });

    expect(logger.error).toHaveBeenCalled();
    expect(sendErrorAlert).toHaveBeenCalled();
  });

  it('handleAdminActionError rethrows Response values', () => {
    const response = new Response(null, { status: 307 });

    expect(() =>
      handleAdminActionError(response, { source: 'admin.test' })
    ).toThrow(response);
  });
});
