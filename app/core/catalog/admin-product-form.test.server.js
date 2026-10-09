import { describe, expect, it, vi } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({ default: {} }));
vi.mock('#/core/catalog/index.server', () => ({
  publishProduct: vi.fn(),
  unpublishProduct: vi.fn(),
}));
vi.mock('#/core/inventory/locations/index.server', () => ({
  setDefaultLocationQuantity: vi.fn(),
}));

import { parseVariantPriceFormData } from '#/core/catalog/admin-product-form.server';

describe('parseVariantPriceFormData', () => {
  it('converts decimal inputs to cents per variant and currency', () => {
    const formData = new FormData();
    formData.set('price[v1][USD]', '19.99');
    formData.set('comparePrice[v1][USD]', '24.5');
    formData.set('price[v1][EUR]', '');

    expect(parseVariantPriceFormData(formData)).toEqual({
      v1: {
        USD: { priceCents: 1999, comparePriceCents: 2450 },
        EUR: { priceCents: 0 },
      },
    });
  });

  it('rounds zero-decimal currencies to whole units', () => {
    const formData = new FormData();
    formData.set('price[v1][JPY]', '1000.5');
    formData.set('comparePrice[v1][JPY]', '1200');

    expect(parseVariantPriceFormData(formData)).toEqual({
      v1: { JPY: { priceCents: 100100, comparePriceCents: 120000 } },
    });
  });

  it('ignores fields with malformed currency codes', () => {
    const formData = new FormData();
    formData.set('price[v1][usd]', '5');
    formData.set('price[v1][EURO]', '5');

    expect(parseVariantPriceFormData(formData)).toEqual({});
  });
});
