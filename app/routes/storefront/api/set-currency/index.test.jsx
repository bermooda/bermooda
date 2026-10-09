import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/storefront/page-context.server', () => ({
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

vi.mock('#/core/cart/index.server', () => ({
  getCart: vi.fn(),
  setCartCurrency: vi.fn(),
}));

vi.mock('#/libs/error/index.server', () => ({
  handleError: vi.fn(),
}));

vi.mock('#/core/settings/index.server', () => ({
  getEnabledCurrencies: vi.fn().mockResolvedValue(['USD', 'EUR']),
  isValidCurrencyCode: vi.fn((code) => /^[A-Z]{3}$/.test(code)),
}));

import { handleError } from '#/libs/error/index.server';
import { getCart, setCartCurrency } from '#/core/cart/index.server';
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

  function switchRequest(currency, cookie = 'cart_token=tok_1') {
    const form = new FormData();
    form.set('currency', currency);
    form.set('returnTo', '/');
    return new Request('http://localhost/api/set-currency', {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
  }

  it('reprices the cart into the chosen currency', async () => {
    getCart.mockResolvedValue({ id: 'cart_1', currency: 'USD' });

    const response = await setCurrencyAction({
      request: switchRequest('EUR'),
    });

    expect(setCartCurrency).toHaveBeenCalledWith('cart_1', 'EUR');
    expect(setCurrencyCookie).toHaveBeenCalledWith(response, 'EUR');
  });

  it('keeps the cart currency when items have no price there', async () => {
    getCart.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    setCartCurrency.mockRejectedValue(new Error('PRICE_NOT_FOUND'));

    const response = await setCurrencyAction({
      request: switchRequest('EUR'),
    });

    expect(response.status).toBe(302);
    expect(setCurrencyCookie).toHaveBeenCalledWith(response, 'EUR');
    expect(handleError).not.toHaveBeenCalled();
  });

  it('still saves the preference when repricing fails unexpectedly', async () => {
    getCart.mockRejectedValue(new Error('db down'));

    const response = await setCurrencyAction({
      request: switchRequest('EUR'),
    });

    expect(response.status).toBe(302);
    expect(setCurrencyCookie).toHaveBeenCalledWith(response, 'EUR');
    expect(handleError).toHaveBeenCalled();
  });

  it('skips the cart lookup without a cart cookie', async () => {
    await setCurrencyAction({ request: switchRequest('EUR', '') });
    expect(getCart).not.toHaveBeenCalled();
  });
});
