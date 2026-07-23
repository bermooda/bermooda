import { describe, expect, it } from 'vitest';

import { carrierProvider } from '#/core/shipping/carrier/index.server';

function makeCart(lines = [{ priceCentsSnapshot: 2000, quantity: 1 }]) {
  return { lines };
}

describe('carrierProvider.getQuotes', () => {
  it('returns normalized ShippingOption shape for domestic US addresses', async () => {
    const quotes = await carrierProvider.getQuotes({
      shippingAddress: { country: 'US' },
      cart: makeCart(),
    });

    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({
      id: 'domestic-standard',
      providerId: 'carrier',
      name: 'Standard shipping',
      priceCents: 599,
      estimatedDays: 5,
    });
    expect(quotes[1]).toMatchObject({
      id: 'domestic-express',
      providerId: 'carrier',
      priceCents: 1299,
    });
  });

  it('returns international options for non-US addresses', async () => {
    const quotes = await carrierProvider.getQuotes({
      shippingAddress: { country: 'GB' },
      cart: makeCart(),
    });

    expect(quotes[0]).toMatchObject({
      id: 'international-standard',
      providerId: 'carrier',
      priceCents: 1499,
    });
  });
});
