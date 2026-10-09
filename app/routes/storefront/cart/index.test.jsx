import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('#/core/cart/index.server', () => ({
  createCart: vi.fn(),
  getCart: vi.fn(),
  addLine: vi.fn(),
  removeLine: vi.fn(),
  setCartCurrency: vi.fn(),
  updateQuantity: vi.fn(),
}));

vi.mock('#/core/channels/index.server', () => ({
  resolveChannelFromRequest: vi.fn(),
}));

vi.mock('#/core/currency/index.server', () => ({
  getRequestCurrency: vi.fn().mockResolvedValue('USD'),
}));

vi.mock('#/core/i18n/index.server', () => ({
  getRequestLocale: vi.fn().mockResolvedValue('en'),
}));

vi.mock('#/libs/auth/customer/index.server', () => ({
  getCustomerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('#/core/themes/index.server', () => ({
  preloadStorefrontTheme: vi.fn().mockResolvedValue('default'),
  getSlotBlocksMap: vi.fn().mockResolvedValue({}),
  getRegisteredTheme: vi.fn().mockReturnValue(null),
  loadThemeSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock('#/core/themes/storefront-components', () => ({
  getStorefrontComponent: vi.fn(() => () => null),
}));

import {
  addLine,
  createCart,
  getCart,
  setCartCurrency,
} from '#/core/cart/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';

import { action, loader } from '#/routes/storefront/cart';

describe('storefront cart action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveChannelFromRequest.mockResolvedValue({ id: 'ch_1' });
  });

  it('creates cart and adds line on intent=add', async () => {
    createCart.mockResolvedValue({ id: 'cart_1', token: 'tok_new' });
    getCart.mockResolvedValue(null);
    addLine.mockResolvedValue({ id: 'line_1' });

    const form = new FormData();
    form.set('intent', 'add');
    form.set('variantId', 'var_1');
    form.set('quantity', '2');

    const request = new Request('http://localhost/cart', {
      method: 'POST',
      body: form,
    });

    const response = await action({ request });
    expect(response.status).toBe(302);
    expect(resolveChannelFromRequest).toHaveBeenCalledWith(request);
    expect(createCart).toHaveBeenCalledWith({
      currency: 'USD',
      customerId: undefined,
      salesChannelId: 'ch_1',
    });
    expect(addLine).toHaveBeenCalledWith(
      'cart_1',
      'var_1',
      2,
      expect.objectContaining({ currency: 'USD', locale: 'en' })
    );
    expect(response.headers.get('Set-Cookie')).toContain('cart_token=tok_new');
  });

  function addRequest() {
    const form = new FormData();
    form.set('intent', 'add');
    form.set('variantId', 'var_1');
    return new Request('http://localhost/cart', {
      method: 'POST',
      headers: { cookie: 'cart_token=tok_1' },
      body: form,
    });
  }

  it('moves an existing cart to the request currency before adding', async () => {
    getCart.mockResolvedValue({
      id: 'cart_1',
      token: 'tok_1',
      currency: 'EUR',
    });
    setCartCurrency.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    addLine.mockResolvedValue({ id: 'line_1' });

    const response = await action({ request: addRequest() });

    expect(setCartCurrency).toHaveBeenCalledWith('cart_1', 'USD');
    expect(addLine).toHaveBeenCalledWith(
      'cart_1',
      'var_1',
      1,
      expect.objectContaining({ currency: 'USD' })
    );
    expect(response.status).toBe(302);
  });

  it('explains when cart items have no price in the new currency', async () => {
    getCart.mockResolvedValue({
      id: 'cart_1',
      token: 'tok_1',
      currency: 'EUR',
    });
    setCartCurrency.mockRejectedValue(new Error('PRICE_NOT_FOUND'));

    const result = await action({ request: addRequest() });

    expect(result.error).toMatch(/aren't available in USD.*back to EUR/);
    expect(addLine).not.toHaveBeenCalled();
  });

  it('leaves a cart already in the request currency alone', async () => {
    getCart.mockResolvedValue({
      id: 'cart_1',
      token: 'tok_1',
      currency: 'USD',
    });
    addLine.mockResolvedValue({ id: 'line_1' });

    await action({ request: addRequest() });

    expect(setCartCurrency).not.toHaveBeenCalled();
    expect(addLine).toHaveBeenCalled();
  });
});

describe('storefront cart loader', () => {
  it('labels the cart with its own currency', async () => {
    getCart.mockResolvedValue({ id: 'cart_1', currency: 'EUR', lines: [] });

    const data = await loader({
      request: new Request('http://localhost/cart', {
        headers: { cookie: 'cart_token=tok_1' },
      }),
    });

    expect(data.currency).toBe('EUR');
  });

  it('falls back to the request currency without a cart', async () => {
    getCart.mockResolvedValue(null);

    const data = await loader({
      request: new Request('http://localhost/cart'),
    });

    expect(data.currency).toBe('USD');
  });
});
