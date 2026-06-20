// app/core/checkout/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('#/libs/prisma.server', () => ({
  default: {
    checkoutSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('#/core/cart/index.server', () => ({
  lockCart: vi.fn(),
  unlockCart: vi.fn(),
}));

vi.mock('#/core/discounts/index.server', () => ({
  resolvePromotions: vi.fn(),
}));

vi.mock('#/core/shipping/index.server', () => ({
  getAllQuotes: vi.fn(),
}));

vi.mock('#/core/tax/index.server', () => ({
  computeActiveTax: vi.fn(),
}));

vi.mock('#/core/pricing/index.server', () => ({
  getCustomerGroupIds: vi.fn(),
  resolveVariantPrice: vi.fn(),
}));

vi.mock('#/core/gift-cards/index.server', () => ({
  resolveGiftCardRedemption: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import prisma from '#/libs/prisma.server';

import { lockCart, unlockCart } from '#/core/cart/index.server';
import {
  createCheckoutSession,
  advanceStep,
  abandonCheckoutSession,
} from '#/core/checkout/pipeline.server';
import { computeTotals } from '#/core/checkout/totals.server';
import { resolvePromotions } from '#/core/discounts/index.server';
import { getAllQuotes } from '#/core/shipping/index.server';
import { computeActiveTax } from '#/core/tax/index.server';
import { resolveVariantPrice } from '#/core/pricing/index.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCart(overrides = {}) {
  return {
    id: 'cart_1',
    currency: 'USD',
    lines: [
      { priceCentsSnapshot: 1000, quantity: 2 },
      { priceCentsSnapshot: 500, quantity: 1 },
    ],
    ...overrides,
  };
}

function makeSession(overrides = {}) {
  return {
    id: 'sess_1',
    cartId: 'cart_1',
    step: 'address',
    shippingAddressJson: null,
    billingAddressJson: null,
    shippingOptionJson: null,
    paymentIntentId: null,
    couponCode: null,
    cart: makeCart(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Safe defaults
  getAllQuotes.mockResolvedValue([]);
  computeActiveTax.mockResolvedValue({ taxCents: 0, rate: 0 });
  resolveVariantPrice.mockResolvedValue(null);
  resolvePromotions.mockResolvedValue({
    applied: [],
    discountCents: 0,
    freeShipping: false,
    primaryCode: null,
  });
});

// ---------------------------------------------------------------------------
// computeTotals — subtotal calculation
// ---------------------------------------------------------------------------

describe('computeTotals — subtotal calculation', () => {
  it('correctly sums priceCentsSnapshot * quantity for each line', async () => {
    const cart = makeCart(); // 1000*2 + 500*1 = 2500

    const result = await computeTotals({ cart });

    expect(result.subtotalCents).toBe(2500);
  });

  it('returns subtotalCents=0 for a cart with no lines', async () => {
    const cart = makeCart({ lines: [] });

    const result = await computeTotals({ cart });

    expect(result.subtotalCents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeTotals — no address → shippingCents=0, taxCents=0
// ---------------------------------------------------------------------------

describe('computeTotals — no shippingAddress', () => {
  it('returns shippingCents=0 and taxCents=0 when shippingAddress is null', async () => {
    const cart = makeCart();

    const result = await computeTotals({ cart, shippingAddress: null });

    expect(result.shippingCents).toBe(0);
    expect(result.taxCents).toBe(0);
    expect(getAllQuotes).not.toHaveBeenCalled();
    expect(computeActiveTax).not.toHaveBeenCalled();
  });

  it('returns shippingCents=0 and taxCents=0 when shippingAddress is undefined', async () => {
    const cart = makeCart();

    const result = await computeTotals({ cart });

    expect(result.shippingCents).toBe(0);
    expect(result.taxCents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeTotals — coupon / discount
// ---------------------------------------------------------------------------

describe('computeTotals — with coupon code', () => {
  it('applies discountCents from resolvePromotions result', async () => {
    const cart = makeCart();
    resolvePromotions.mockResolvedValue({
      applied: [{ code: 'SAVE10', discountCents: 250 }],
      discountCents: 250,
      freeShipping: false,
      primaryCode: 'SAVE10',
    });

    const result = await computeTotals({ cart, couponCode: 'SAVE10' });

    expect(resolvePromotions).toHaveBeenCalledWith(
      expect.objectContaining({ couponCode: 'SAVE10' })
    );
    expect(result.discountCents).toBe(250);
    expect(result.totalCents).toBe(2500 - 250);
  });

  it('uses discountCents=0 when couponCode is not provided', async () => {
    const cart = makeCart();

    const result = await computeTotals({ cart });

    expect(result.discountCents).toBe(0);
  });

  it('silently sets discountCents=0 when resolvePromotions throws', async () => {
    const cart = makeCart();
    resolvePromotions.mockRejectedValue(new Error('DISCOUNT_EXPIRED'));

    const result = await computeTotals({ cart, couponCode: 'BADCODE' });

    expect(result.discountCents).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeTotals — shipping option selection
// ---------------------------------------------------------------------------

describe('computeTotals — shippingOptionId matching', () => {
  it('selects the matching option priceCents when shippingOptionId matches', async () => {
    const cart = makeCart();
    const address = { country: 'AU' };
    getAllQuotes.mockResolvedValue([
      { id: 'flat_rate:domestic', priceCents: 1500, label: 'Domestic' },
      {
        id: 'flat_rate:international',
        priceCents: 3000,
        label: 'International',
      },
    ]);
    computeActiveTax.mockResolvedValue({ taxCents: 0, rate: 0 });

    const result = await computeTotals({
      cart,
      shippingAddress: address,
      shippingOptionId: 'flat_rate:domestic',
    });

    expect(result.shippingCents).toBe(1500);
    expect(result.shippingOption).toMatchObject({ id: 'flat_rate:domestic' });
  });

  it('uses shippingCents=0 when shippingOptionId does not match any quote', async () => {
    const cart = makeCart();
    const address = { country: 'AU' };
    getAllQuotes.mockResolvedValue([
      { id: 'flat_rate:domestic', priceCents: 1500 },
    ]);
    computeActiveTax.mockResolvedValue({ taxCents: 0, rate: 0 });

    const result = await computeTotals({
      cart,
      shippingAddress: address,
      shippingOptionId: 'unknown',
    });

    expect(result.shippingCents).toBe(0);
    expect(result.shippingOption).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeTotals — total formula
// ---------------------------------------------------------------------------

describe('computeTotals — totalCents formula', () => {
  it('totalCents = subtotal - discount + shipping + tax', async () => {
    const cart = makeCart(); // subtotal=2500
    const address = { country: 'AU' };
    resolvePromotions.mockResolvedValue({
      applied: [{ code: 'SAVE10', discountCents: 250 }],
      discountCents: 250,
      freeShipping: false,
      primaryCode: 'SAVE10',
    });
    getAllQuotes.mockResolvedValue([{ id: 'opt_1', priceCents: 1500 }]);
    computeActiveTax.mockResolvedValue({ taxCents: 225, rate: 0.1 });

    const result = await computeTotals({
      cart,
      shippingAddress: address,
      couponCode: 'SAVE10',
      shippingOptionId: 'opt_1',
    });

    // 2500 - 250 + 1500 + 225 = 3975
    expect(result.subtotalCents).toBe(2500);
    expect(result.discountCents).toBe(250);
    expect(result.shippingCents).toBe(1500);
    expect(result.taxCents).toBe(225);
    expect(result.totalCents).toBe(3975);
  });
});

// ---------------------------------------------------------------------------
// createCheckoutSession — calls lockCart
// ---------------------------------------------------------------------------

describe('createCheckoutSession', () => {
  it('calls lockCart with the provided cartId', async () => {
    lockCart.mockResolvedValue({ id: 'cart_1', lockedAt: new Date() });
    prisma.checkoutSession.create.mockResolvedValue(makeSession());

    await createCheckoutSession('cart_1');

    expect(lockCart).toHaveBeenCalledWith('cart_1');
  });

  it('creates session with step=address and provided cartId', async () => {
    lockCart.mockResolvedValue({});
    prisma.checkoutSession.create.mockResolvedValue(makeSession());

    await createCheckoutSession('cart_1', { email: 'test@example.com' });

    expect(prisma.checkoutSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cartId: 'cart_1',
        step: 'address',
        email: 'test@example.com',
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// advanceStep — address → shipping
// ---------------------------------------------------------------------------

describe('advanceStep — address to shipping', () => {
  it('saves shippingAddressJson and advances step to shipping', async () => {
    const session = makeSession({ step: 'address' });
    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    prisma.checkoutSession.update.mockResolvedValue({
      ...session,
      step: 'shipping',
      shippingAddressJson: '{"country":"AU"}',
      cart: makeCart(),
    });

    const result = await advanceStep('sess_1', {
      shippingAddressJson: '{"country":"AU"}',
    });

    expect(prisma.checkoutSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sess_1' },
        data: expect.objectContaining({
          shippingAddressJson: '{"country":"AU"}',
          step: 'shipping',
        }),
      })
    );
    expect(result.step).toBe('shipping');
  });

  it('attaches totals to the returned session', async () => {
    const session = makeSession({ step: 'address' });
    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    prisma.checkoutSession.update.mockResolvedValue({
      ...session,
      step: 'shipping',
      shippingAddressJson: '{"country":"AU"}',
      cart: makeCart(),
    });
    getAllQuotes.mockResolvedValue([]);
    computeActiveTax.mockResolvedValue({ taxCents: 0, rate: 0 });

    const result = await advanceStep('sess_1', {
      shippingAddressJson: '{"country":"AU"}',
    });

    expect(result.totals).toBeDefined();
    expect(typeof result.totals.subtotalCents).toBe('number');
    expect(typeof result.totals.totalCents).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// advanceStep — throws when required stepData is missing
// ---------------------------------------------------------------------------

describe('advanceStep — validation errors', () => {
  it('throws MISSING_SHIPPING_ADDRESS when shippingAddressJson is absent on address step', async () => {
    const session = makeSession({ step: 'address' });
    prisma.checkoutSession.findUnique.mockResolvedValue(session);

    await expect(advanceStep('sess_1', {})).rejects.toThrow(
      'MISSING_SHIPPING_ADDRESS'
    );
    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
  });

  it('throws MISSING_SHIPPING_OPTION when shippingOptionId is absent on shipping step', async () => {
    const session = makeSession({
      step: 'shipping',
      shippingAddressJson: '{"country":"AU"}',
    });
    prisma.checkoutSession.findUnique.mockResolvedValue(session);

    await expect(advanceStep('sess_1', {})).rejects.toThrow(
      'MISSING_SHIPPING_OPTION'
    );
    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
  });

  it('throws MISSING_PAYMENT_PROVIDER when paymentProvider is absent on payment step', async () => {
    const session = makeSession({
      step: 'payment',
      shippingAddressJson: '{"country":"AU"}',
      shippingOptionJson: '{"id":"opt_1","priceCents":1500}',
    });
    prisma.checkoutSession.findUnique.mockResolvedValue(session);

    await expect(advanceStep('sess_1', {})).rejects.toThrow(
      'MISSING_PAYMENT_PROVIDER'
    );
    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// advanceStep — shipping step
// ---------------------------------------------------------------------------

describe('advanceStep — shipping to payment', () => {
  it('saves shippingOptionJson and advances step to payment', async () => {
    const session = makeSession({
      step: 'shipping',
      shippingAddressJson: '{"country":"AU"}',
    });
    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    prisma.checkoutSession.update.mockResolvedValue({
      ...session,
      step: 'payment',
      shippingOptionJson: '{"id":"opt_1","priceCents":1500}',
      cart: makeCart(),
    });
    getAllQuotes.mockResolvedValue([{ id: 'opt_1', priceCents: 1500 }]);
    computeActiveTax.mockResolvedValue({ taxCents: 0, rate: 0 });

    const result = await advanceStep('sess_1', {
      shippingOptionId: 'opt_1',
      shippingOptionJson: '{"id":"opt_1","priceCents":1500}',
    });

    expect(prisma.checkoutSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingOptionJson: '{"id":"opt_1","priceCents":1500}',
          step: 'payment',
        }),
      })
    );
    expect(result.step).toBe('payment');
  });
});

// ---------------------------------------------------------------------------
// advanceStep — review step returns session as-is (with totals)
// ---------------------------------------------------------------------------

describe('advanceStep — review step', () => {
  it('returns session as-is without updating when step is review', async () => {
    const session = makeSession({
      step: 'review',
      shippingAddressJson: '{"country":"AU"}',
    });
    prisma.checkoutSession.findUnique.mockResolvedValue(session);
    getAllQuotes.mockResolvedValue([]);
    computeActiveTax.mockResolvedValue({ taxCents: 0, rate: 0 });

    const result = await advanceStep('sess_1', {});

    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
    expect(result.step).toBe('review');
    expect(result.totals).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// abandonCheckoutSession — calls unlockCart
// ---------------------------------------------------------------------------

describe('abandonCheckoutSession', () => {
  it('calls unlockCart with the session cartId', async () => {
    prisma.checkoutSession.findUnique.mockResolvedValue({
      id: 'sess_1',
      cartId: 'cart_1',
    });
    unlockCart.mockResolvedValue({ id: 'cart_1', lockedAt: null });

    await abandonCheckoutSession('sess_1');

    expect(unlockCart).toHaveBeenCalledWith('cart_1');
  });

  it('throws CHECKOUT_SESSION_NOT_FOUND when session does not exist', async () => {
    prisma.checkoutSession.findUnique.mockResolvedValue(null);

    await expect(abandonCheckoutSession('nonexistent')).rejects.toThrow(
      'CHECKOUT_SESSION_NOT_FOUND'
    );
    expect(unlockCart).not.toHaveBeenCalled();
  });
});
