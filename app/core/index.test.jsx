// app/core/index.test.jsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Slot,
  dto,
  formatPrice,
  selectors,
  translate,
  useShop,
} from '#/core/index';

// ---------------------------------------------------------------------------
// useShop
// ---------------------------------------------------------------------------

describe('useShop', () => {
  it('returns default currency and locale', () => {
    const { result } = renderHook(() => useShop());
    expect(result.current.currency).toBe('USD');
    expect(result.current.locale).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

describe('Slot', () => {
  it('returns children when provided', () => {
    const children = 'hello';
    expect(Slot({ name: 'test', children })).toBe('hello');
  });

  it('returns null when no children', () => {
    expect(Slot({ name: 'test' })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// selectors
// ---------------------------------------------------------------------------

describe('selectors.cartLineCount', () => {
  it('returns 0 when cart is null', () => {
    expect(selectors.cartLineCount(null)).toBe(0);
  });

  it('returns 0 when cart has no lines', () => {
    expect(selectors.cartLineCount({ lines: [] })).toBe(0);
  });

  it('returns the number of lines', () => {
    expect(selectors.cartLineCount({ lines: [1, 2, 3] })).toBe(3);
  });
});

describe('selectors.cartTotal', () => {
  it('returns 0 when cart is null', () => {
    expect(selectors.cartTotal(null)).toBe(0);
  });

  it('returns 0 when cart has no lines', () => {
    expect(selectors.cartTotal({ lines: [] })).toBe(0);
  });

  it('sums priceCentsSnapshot * quantity for all lines', () => {
    expect(
      selectors.cartTotal({
        lines: [
          { priceCentsSnapshot: 1000, quantity: 2 },
          { priceCentsSnapshot: 500, quantity: 1 },
        ],
      })
    ).toBe(2500);
  });
});

// ---------------------------------------------------------------------------
// dto
// ---------------------------------------------------------------------------

describe('dto.product', () => {
  it('maps id, title, and slug', () => {
    const result = dto.product({
      id: 'p1',
      title: 'Shirt',
      slug: { slug: 'shirt' },
    });
    expect(result).toEqual({
      id: 'p1',
      title: 'Shirt',
      slug: { slug: 'shirt' },
    });
  });

  it('maps null slug when not provided', () => {
    const result = dto.product({ id: 'p1', title: 'Shirt' });
    expect(result.slug).toBeNull();
  });
});

describe('dto.variant', () => {
  it('maps id, title, sku, inventoryQuantity', () => {
    const result = dto.variant({
      id: 'v1',
      title: 'Blue',
      sku: 'SKU-1',
      inventoryQuantity: 5,
    });
    expect(result).toEqual({
      id: 'v1',
      title: 'Blue',
      sku: 'SKU-1',
      inventoryQuantity: 5,
    });
  });

  it('maps null sku when not provided', () => {
    const result = dto.variant({
      id: 'v1',
      title: 'Blue',
      inventoryQuantity: 5,
    });
    expect(result.sku).toBeNull();
  });
});

describe('dto.order', () => {
  it('maps id, orderNumber, status, totalCents', () => {
    const result = dto.order({
      id: 'o1',
      orderNumber: 'ORD-001',
      status: 'pending',
      totalCents: 1999,
    });
    expect(result).toEqual({
      id: 'o1',
      orderNumber: 'ORD-001',
      status: 'pending',
      totalCents: 1999,
    });
  });
});

// ---------------------------------------------------------------------------
// translate re-export
// ---------------------------------------------------------------------------

describe('translate (re-exported from core)', () => {
  it('is a function', () => {
    expect(typeof translate).toBe('function');
  });

  it('returns key when message not found', () => {
    expect(translate('some.key')).toBe('some.key');
  });
});

// ---------------------------------------------------------------------------
// formatPrice (re-exported from core)
// ---------------------------------------------------------------------------

describe('formatPrice (re-exported from core)', () => {
  it('is a function', () => {
    expect(typeof formatPrice).toBe('function');
  });
});
