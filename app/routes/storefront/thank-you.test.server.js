import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('#/core/orders/index.server', () => ({
  getOrderByOrderNumber: vi.fn(),
}));

vi.mock('#/libs/api/storefront.server', () => ({
  loadStorefrontPageContext: vi.fn().mockResolvedValue({
    themeId: 'default',
    locale: 'en',
    currency: 'USD',
  }),
}));

vi.mock('#/core/themes/storefront-components', () => ({
  getStorefrontComponent: vi.fn(() => () => null),
}));

import { getOrderByOrderNumber } from '#/core/orders/index.server';

import { loader } from '#/routes/storefront/thank-you/$orderNumber';

describe('storefront thank-you loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns order and clears checkout session cookie', async () => {
    getOrderByOrderNumber.mockResolvedValue({
      id: 'ord_1',
      orderNumber: 'ORD-100',
      lines: [],
    });

    const response = await loader({
      request: new Request('http://localhost/thank-you/ORD-100'),
      params: { orderNumber: 'ORD-100' },
    });

    expect(getOrderByOrderNumber).toHaveBeenCalledWith('ORD-100');
    expect(response.headers.get('Set-Cookie')).toContain('checkout_session=');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');

    const body = await response.json();
    expect(body.order.orderNumber).toBe('ORD-100');
    expect(body.themeId).toBe('default');
  });

  it('throws 404 when order is missing', async () => {
    getOrderByOrderNumber.mockResolvedValue(null);

    await expect(
      loader({
        request: new Request('http://localhost/thank-you/MISSING'),
        params: { orderNumber: 'MISSING' },
      })
    ).rejects.toMatchObject({ status: 404 });
  });
});
