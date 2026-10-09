import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/auth/customer/index.server', () => ({
  getCustomerSession: vi.fn().mockResolvedValue(null),
}));
vi.mock('#/libs/error/index.server', () => ({
  handleError: vi.fn(() => ({ error: 'handled' })),
}));
vi.mock('#/core/address-validation/index.server', () => ({
  normalizeAddressForSession: vi.fn(),
}));
vi.mock('#/core/cart/index.server', () => ({
  getCart: vi.fn(),
}));
vi.mock('#/core/checkout/index.server', () => ({
  buildComputeTotalsParams: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutSession: vi.fn(),
  linkCheckoutCustomer: vi.fn(),
  normaliseCheckoutSessionForDisplay: vi.fn(),
  parseCheckoutSessionFields: vi.fn(),
  updateCheckoutSession: vi.fn(),
}));
vi.mock('#/core/checkout/storefront.server', () => ({
  buildCheckoutPayload: vi.fn(() => ({ shippingOptionId: 'standard' })),
  buildSessionUpdateData: vi.fn(),
  loadCheckoutDisplayData: vi.fn(),
  persistCheckoutSessionForPlaceOrder: vi.fn(),
  resolveCheckoutPlaceOrderResult: vi.fn(),
}));
vi.mock('#/core/checkout/totals.server', () => ({
  computeTotals: vi.fn(),
}));
vi.mock('#/core/shipping/index.server', () => ({
  getAllQuotes: vi.fn(),
}));
vi.mock('#/core/storefront/page-context.server', () => ({
  loadStorefrontPageContext: vi.fn().mockResolvedValue({ themeId: 'default' }),
}));
vi.mock('#/core/themes/storefront-components', () => ({
  getStorefrontComponent: vi.fn(() => () => null),
}));

import { handleError } from '#/libs/error/index.server';
import { getCheckoutSession } from '#/core/checkout/index.server';
import {
  buildSessionUpdateData,
  resolveCheckoutPlaceOrderResult,
} from '#/core/checkout/storefront.server';

import { action } from '#/routes/storefront/checkout';

function placeOrderRequest() {
  const form = new FormData();
  form.set('intent', 'place-order');
  return new Request('http://localhost/checkout', {
    method: 'POST',
    headers: { cookie: 'checkout_session=sess_1' },
    body: form,
  });
}

describe('storefront checkout action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCheckoutSession.mockResolvedValue({ id: 'sess_1', cart: {} });
    buildSessionUpdateData.mockResolvedValue({
      hasAddress: true,
      shippingOptionJson: '{"id":"standard"}',
      shippingAddressJson: '{}',
    });
  });

  it('explains a disabled cart currency instead of a payment failure', async () => {
    resolveCheckoutPlaceOrderResult.mockRejectedValue(
      new Error('CART_CURRENCY_DISABLED')
    );

    const result = await action({ request: placeOrderRequest() });

    expect(result.error).toMatch(/no longer accepts/);
    expect(handleError).not.toHaveBeenCalled();
  });

  it('reports other place-order failures through handleError', async () => {
    resolveCheckoutPlaceOrderResult.mockRejectedValue(new Error('boom'));

    const result = await action({ request: placeOrderRequest() });

    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'storefront.checkout.placeOrder' })
    );
    expect(result).toEqual({ error: 'handled' });
  });
});
