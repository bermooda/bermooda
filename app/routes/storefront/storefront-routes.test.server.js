import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('#/core/i18n/index.server', () => ({
  getAvailableLocales: vi.fn().mockResolvedValue(['en', 'de']),
  setLocaleCookie: vi.fn(),
}));

vi.mock('#/core/currency/index.server', () => ({
  setCurrencyCookie: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  getEnabledCurrencies: vi.fn().mockResolvedValue(['USD', 'EUR']),
  isValidCurrencyCode: vi.fn((code) => /^[A-Z]{3}$/.test(code)),
}));

import { setCurrencyCookie } from '#/core/currency/index.server';
import { setLocaleCookie } from '#/core/i18n/index.server';

import { action as setCurrencyAction } from '#/routes/storefront/api/set-currency';
import { action as setLocaleAction } from '#/routes/storefront/api/set-locale';

describe('storefront locale/currency actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('set-locale sets cookie for enabled locale', async () => {
    const form = new FormData();
    form.set('locale', 'de');
    form.set('returnTo', '/cart');

    const response = await setLocaleAction({
      request: new Request('http://localhost/api/set-locale', {
        method: 'POST',
        body: form,
      }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/cart');
    expect(setLocaleCookie).toHaveBeenCalledWith(response, 'de');
  });

  it('set-locale ignores invalid locale but still redirects', async () => {
    const form = new FormData();
    form.set('locale', 'xx');
    form.set('returnTo', '/');

    const response = await setLocaleAction({
      request: new Request('http://localhost/api/set-locale', {
        method: 'POST',
        body: form,
      }),
    });

    expect(response.status).toBe(302);
    expect(setLocaleCookie).not.toHaveBeenCalled();
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
