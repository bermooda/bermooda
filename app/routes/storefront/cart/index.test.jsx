import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('#/core/cart/index.server', () => ({
  createCart: vi.fn(),
  getCart: vi.fn(),
  addLine: vi.fn(),
  removeLine: vi.fn(),
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

import { createCart, getCart, addLine } from '#/core/cart/index.server';
import { resolveChannelFromRequest } from '#/core/channels/index.server';

import { action } from '#/routes/storefront/cart';

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
});
