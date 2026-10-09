import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/core/address-validation/index.server', () => ({
  normalizeAddressForSession: vi.fn(),
  parseAddressInput: vi.fn(),
}));
vi.mock('#/core/checkout/index.server', () => ({
  buildComputeTotalsParams: vi.fn(() => ({})),
  getCheckoutSession: vi.fn(),
  parseCheckoutSessionFields: vi.fn(() => ({ shippingAddress: null })),
  normaliseCheckoutSessionForDisplay: vi.fn((session) => session),
  updateCheckoutSession: vi.fn(),
}));
vi.mock('#/core/checkout/totals.server', () => ({
  computeTotals: vi.fn().mockResolvedValue({ totalCents: 0 }),
}));
vi.mock('#/core/currency/index.server', () => ({
  getRequestCurrency: vi.fn().mockResolvedValue('USD'),
}));
vi.mock('#/core/i18n/index.server', () => ({
  getRequestLocale: vi.fn().mockResolvedValue('en'),
}));
vi.mock('#/core/loyalty/index.server', () => ({
  getCustomerLoyaltySummary: vi.fn(),
}));
vi.mock('#/core/orders/place.server', () => ({
  attachPaymentIntent: vi.fn(),
  placeOrder: vi.fn(),
}));
vi.mock('#/core/payments/index.server', () => ({
  createPaymentIntent: vi.fn(),
  createPaymentSession: vi.fn(),
  getProvider: vi.fn(),
  listProvidersWithDetails: vi.fn(() => []),
}));
vi.mock('#/core/shipping/index.server', () => ({
  getAllQuotes: vi.fn(),
  resolveShippingOption: vi.fn(),
}));
vi.mock('#/core/store-credit/index.server', () => ({
  getCustomerStoreCreditSummary: vi.fn(),
}));
vi.mock('#/core/themes/index.server', () => ({
  getSlotBlocksMap: vi.fn().mockResolvedValue({}),
}));

import { loadCheckoutDisplayData } from '#/core/checkout/storefront.server';
import { getRequestCurrency } from '#/core/currency/index.server';

describe('loadCheckoutDisplayData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const request = new Request('http://localhost/checkout');

  it("displays totals in the cart's currency, not the request currency", async () => {
    const cart = { id: 'cart_1', currency: 'EUR', lines: [] };

    const data = await loadCheckoutDisplayData(request, { cart }, cart);

    expect(data.currency).toBe('EUR');
    expect(getRequestCurrency).not.toHaveBeenCalled();
  });

  it('falls back to the request currency without a cart', async () => {
    const data = await loadCheckoutDisplayData(request, null, null);

    expect(data.currency).toBe('USD');
  });
});
