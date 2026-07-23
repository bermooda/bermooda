import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/api/storefront/index.server', () => ({
  parseReturnTo: (formData, fallback = '/') => {
    const returnTo = formData.get('returnTo')?.toString();
    if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
      return fallback;
    }
    return returnTo;
  },
}));

vi.mock('#/core/currency/index.server', () => ({
  setCurrencyCookie: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  getEnabledCurrencies: vi.fn().mockResolvedValue(['USD', 'EUR']),
  isValidCurrencyCode: vi.fn((code) => /^[A-Z]{3}$/.test(code)),
}));

import { setCurrencyCookie } from '#/core/currency/index.server';

import { action as setCurrencyAction } from '#/routes/storefront/api/set-currency';

describe('storefront set-currency action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('set-currency sets cookie for enabled currency', async () => {
    const form = new FormData();
    form.set('currency', 'eur');
    form.set('returnTo', '/');

    const response = await setCurrencyAction({
      request: new Request('http://localhost/api/set-currency', {
        method: 'POST',
        body: form,
      }),
    });

    expect(response.status).toBe(302);
    expect(setCurrencyCookie).toHaveBeenCalledWith(response, 'EUR');
  });
});
