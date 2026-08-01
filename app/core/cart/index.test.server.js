// app/core/cart/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    cart: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    cartLine: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    variantPrice: {
      findUnique: vi.fn(),
    },
    translation: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('#/core/pricing/index.server', () => ({
  getCustomerGroupIds: vi.fn(),
  resolveVariantPrice: vi.fn(),
}));

vi.mock('#/core/events/job.server', () => ({
  queueEmit: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import {
  createCart,
  addLine,
  removeLine,
  updateQuantity,
  mergeGuestCart,
  expireCarts,
  lockCart,
  unlockCart,
  deleteCart,
} from '#/core/cart/index.server';
import { queueEmit } from '#/core/events/job.server';
import { resolveVariantPrice } from '#/core/pricing/index.server';

beforeEach(() => {
  vi.clearAllMocks();
  resolveVariantPrice.mockResolvedValue({ priceCents: 1000, source: 'base' });
});

// ---------------------------------------------------------------------------
// createCart
// ---------------------------------------------------------------------------

describe('createCart', () => {
  it('generates a UUID token and sets expiresAt ~30 days from now', async () => {
    const before = Date.now();

    prisma.cart.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cart_1', ...data })
    );

    const cart = await createCart({ currency: 'USD' });

    const after = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(cart.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(cart.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + thirtyDaysMs - 100
    );
    expect(cart.expiresAt.getTime()).toBeLessThanOrEqual(
      after + thirtyDaysMs + 100
    );
  });

  it('uses USD as default currency when none provided', async () => {
    prisma.cart.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cart_1', ...data })
    );

    const cart = await createCart();

    expect(cart.currency).toBe('USD');
  });

  it('passes customerId when provided', async () => {
    prisma.cart.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cart_1', ...data })
    );

    const cart = await createCart({ customerId: 'cust_1' });

    expect(prisma.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: 'cust_1' }),
      })
    );
    expect(cart.customerId).toBe('cust_1');
  });

  it('emits cart.created after creating the cart', async () => {
    prisma.cart.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cart_1', ...data })
    );

    const cart = await createCart({ currency: 'EUR', customerId: 'cust_1' });

    expect(queueEmit).toHaveBeenCalledWith(
      'cart.created',
      expect.objectContaining({
        cartId: cart.id,
        token: cart.token,
        currency: 'EUR',
        customerId: 'cust_1',
        expiresAt: expect.any(Date),
      })
    );
  });

  it('persists salesChannelId', async () => {
    prisma.cart.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cart_1', ...data })
    );

    await createCart({ currency: 'USD', salesChannelId: 'ch_1' });

    expect(prisma.cart.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ salesChannelId: 'ch_1' }),
    });
  });

  it('emits salesChannelId on cart.created', async () => {
    prisma.cart.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cart_1', ...data })
    );

    await createCart({ currency: 'USD', salesChannelId: 'ch_1' });

    expect(queueEmit).toHaveBeenCalledWith(
      'cart.created',
      expect.objectContaining({ salesChannelId: 'ch_1' })
    );
  });
});

describe('deleteCart', () => {
  it('returns false when the cart token is not found', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);

    await expect(deleteCart('missing')).resolves.toBe(false);
    expect(prisma.cart.delete).not.toHaveBeenCalled();
  });

  it('deletes the cart when the token exists', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', token: 'tok_1' });
    prisma.cart.delete.mockResolvedValue({ id: 'cart_1' });

    await expect(deleteCart('tok_1')).resolves.toBe(true);
    expect(prisma.cart.delete).toHaveBeenCalledWith({
      where: { id: 'cart_1' },
    });
  });
});

// ---------------------------------------------------------------------------
// addLine — cart not found
// ---------------------------------------------------------------------------

describe('addLine — CART_NOT_FOUND', () => {
  it('throws CART_NOT_FOUND when cart does not exist', async () => {
    prisma.cart.findUnique.mockResolvedValue(null);

    await expect(addLine('missing_cart', 'variant_1', 1)).rejects.toThrow(
      'CART_NOT_FOUND'
    );
  });
});

// ---------------------------------------------------------------------------
// addLine — currency mismatch
// ---------------------------------------------------------------------------

describe('addLine — CURRENCY_MISMATCH', () => {
  it('throws CURRENCY_MISMATCH when caller currency differs from cart currency', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', currency: 'USD' });

    await expect(
      addLine('cart_1', 'variant_1', 1, { currency: 'EUR', locale: 'en' })
    ).rejects.toThrow('CURRENCY_MISMATCH');
  });
});

// ---------------------------------------------------------------------------
// addLine — price not found
// ---------------------------------------------------------------------------

describe('addLine — PRICE_NOT_FOUND', () => {
  it('throws PRICE_NOT_FOUND when no VariantPrice row exists', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    resolveVariantPrice.mockResolvedValue(null);

    await expect(
      addLine('cart_1', 'variant_1', 1, { currency: 'USD', locale: 'en' })
    ).rejects.toThrow('PRICE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// addLine — upsert (increment) behavior
// ---------------------------------------------------------------------------

describe('addLine — upsert', () => {
  it('increments quantity when a line already exists for the same variantId', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    resolveVariantPrice.mockResolvedValue({ priceCents: 800, source: 'base' });
    prisma.translation.findUnique.mockResolvedValue(null);
    prisma.cartLine.findFirst.mockResolvedValue({
      id: 'line_1',
      quantity: 2,
      variantId: 'variant_1',
    });
    prisma.cartLine.update.mockResolvedValue({ id: 'line_1', quantity: 5 });

    await addLine('cart_1', 'variant_1', 3, { locale: 'en' });

    expect(resolveVariantPrice).toHaveBeenCalledWith({
      variantId: 'variant_1',
      currency: 'USD',
      quantity: 5,
      customerGroupIds: [],
    });
    expect(prisma.cartLine.update).toHaveBeenCalledWith({
      where: { id: 'line_1' },
      data: { quantity: 5, priceCentsSnapshot: 800 },
    });
    expect(prisma.cartLine.create).not.toHaveBeenCalled();
    expect(queueEmit).toHaveBeenCalledWith('cart.itemAdded', {
      cartId: 'cart_1',
      variantId: 'variant_1',
      quantity: 3,
      lineId: 'line_1',
    });
  });

  it('creates a new line when no existing line for this variantId', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    resolveVariantPrice.mockResolvedValue({ priceCents: 2500, source: 'base' });
    prisma.translation.findUnique.mockResolvedValue({ value: 'Blue T-Shirt' });
    prisma.cartLine.findFirst.mockResolvedValue(null);
    prisma.cartLine.create.mockResolvedValue({ id: 'line_2', quantity: 1 });

    await addLine('cart_1', 'variant_2', 1, { locale: 'en' });

    expect(prisma.cartLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cartId: 'cart_1',
        variantId: 'variant_2',
        quantity: 1,
        priceCentsSnapshot: 2500,
        titleSnapshot: 'Blue T-Shirt',
      }),
    });
    expect(queueEmit).toHaveBeenCalledWith('cart.itemAdded', {
      cartId: 'cart_1',
      variantId: 'variant_2',
      quantity: 1,
      lineId: 'line_2',
    });
  });

  it('falls back to variantId as titleSnapshot when no translation found', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    resolveVariantPrice.mockResolvedValue({ priceCents: 999, source: 'base' });
    prisma.translation.findUnique.mockResolvedValue(null);
    prisma.cartLine.findFirst.mockResolvedValue(null);
    prisma.cartLine.create.mockResolvedValue({ id: 'line_3', quantity: 1 });

    await addLine('cart_1', 'variant_no_title', 1, { locale: 'en' });

    expect(prisma.cartLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ titleSnapshot: 'variant_no_title' }),
    });
  });
});

// ---------------------------------------------------------------------------
// removeLine
// ---------------------------------------------------------------------------

describe('removeLine', () => {
  it('calls prisma.cartLine.delete with correct ids', async () => {
    prisma.cartLine.delete.mockResolvedValue({});

    await removeLine('cart_1', 'line_1');

    expect(prisma.cartLine.delete).toHaveBeenCalledWith({
      where: { id: 'line_1', cartId: 'cart_1' },
    });
    expect(queueEmit).toHaveBeenCalledWith('cart.itemRemoved', {
      cartId: 'cart_1',
      lineId: 'line_1',
    });
  });
});

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------

describe('updateQuantity', () => {
  it('removes line when quantity is 0', async () => {
    prisma.cartLine.delete.mockResolvedValue({});

    await updateQuantity('cart_1', 'line_1', 0);

    expect(prisma.cartLine.delete).toHaveBeenCalledWith({
      where: { id: 'line_1', cartId: 'cart_1' },
    });
    expect(prisma.cartLine.update).not.toHaveBeenCalled();
  });

  it('removes line when quantity is negative', async () => {
    prisma.cartLine.delete.mockResolvedValue({});

    await updateQuantity('cart_1', 'line_1', -5);

    expect(prisma.cartLine.delete).toHaveBeenCalled();
  });

  it('updates quantity when quantity is positive', async () => {
    prisma.cartLine.findFirst.mockResolvedValue({
      id: 'line_1',
      variantId: 'variant_1',
      quantity: 2,
    });
    prisma.cart.findUnique.mockResolvedValue({
      id: 'cart_1',
      currency: 'USD',
      customerId: null,
    });
    resolveVariantPrice.mockResolvedValue({ priceCents: 700, source: 'base' });
    prisma.cartLine.update.mockResolvedValue({ id: 'line_1', quantity: 4 });

    await updateQuantity('cart_1', 'line_1', 4);

    expect(resolveVariantPrice).toHaveBeenCalledWith({
      variantId: 'variant_1',
      currency: 'USD',
      quantity: 4,
      customerGroupIds: [],
    });
    expect(prisma.cartLine.update).toHaveBeenCalledWith({
      where: { id: 'line_1', cartId: 'cart_1' },
      data: { quantity: 4, priceCentsSnapshot: 700 },
    });
    expect(queueEmit).toHaveBeenCalledWith('cart.updated', {
      cartId: 'cart_1',
      lineId: 'line_1',
      quantity: 4,
    });
  });
});

// ---------------------------------------------------------------------------
// mergeGuestCart
// ---------------------------------------------------------------------------

describe('mergeGuestCart', () => {
  it('reassigns guest cart to customer and rotates token when customer has no cart', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'guest_cart',
      token: 'guest-token',
      lines: [
        {
          id: 'line_1',
          variantId: 'v1',
          quantity: 2,
          priceCentsSnapshot: 500,
          titleSnapshot: 'Item A',
        },
      ],
    });
    prisma.cart.findFirst.mockResolvedValue(null); // no existing customer cart
    prisma.cart.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'guest_cart', customerId: 'cust_1', ...data })
    );

    const result = await mergeGuestCart('guest-token', 'cust_1');

    expect(prisma.cart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'guest_cart' },
        data: expect.objectContaining({ customerId: 'cust_1' }),
      })
    );
    // New token must be a UUID, not the old one.
    expect(result.token).toMatch(/^[0-9a-f]{8}-/);
    expect(result.token).not.toBe('guest-token');
  });

  it('merges guest lines into existing customer cart, deletes guest cart, rotates token', async () => {
    const guestLines = [
      {
        id: 'gl_1',
        variantId: 'v1',
        quantity: 3,
        priceCentsSnapshot: 500,
        titleSnapshot: 'Item A',
      },
      {
        id: 'gl_2',
        variantId: 'v2',
        quantity: 1,
        priceCentsSnapshot: 800,
        titleSnapshot: 'Item B',
      },
    ];
    const customerLines = [
      { id: 'cl_1', variantId: 'v1', quantity: 1 }, // same variant — should increment
    ];

    prisma.cart.findUnique.mockResolvedValue({
      id: 'guest_cart',
      token: 'guest-token',
      currency: 'USD',
      lines: guestLines,
    });
    prisma.cart.findFirst.mockResolvedValue({
      id: 'cust_cart',
      customerId: 'cust_1',
      currency: 'USD',
      lines: customerLines,
    });
    prisma.cartLine.update.mockResolvedValue({});
    prisma.cartLine.create.mockResolvedValue({});
    prisma.cart.delete.mockResolvedValue({});
    prisma.cart.update.mockResolvedValue({
      id: 'cust_cart',
      token: 'new-token',
    });

    await mergeGuestCart('guest-token', 'cust_1');

    // v1 should be incremented on customer cart (1 + 3 = 4).
    expect(prisma.cartLine.update).toHaveBeenCalledWith({
      where: { id: 'cl_1' },
      data: { quantity: 4 },
    });
    // v2 is new on customer cart — should be created.
    expect(prisma.cartLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cartId: 'cust_cart',
        variantId: 'v2',
        quantity: 1,
      }),
    });
    // Guest cart deleted.
    expect(prisma.cart.delete).toHaveBeenCalledWith({
      where: { id: 'guest_cart' },
    });
    // Token rotated on surviving cart.
    expect(prisma.cart.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cust_cart' } })
    );
  });

  it('deletes guest cart and returns customer cart unchanged when currencies differ', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'guest_cart',
      token: 'guest-token',
      currency: 'EUR',
      lines: [],
    });
    prisma.cart.findFirst.mockResolvedValue({
      id: 'cust_cart',
      customerId: 'cust_1',
      currency: 'USD',
      lines: [],
    });
    prisma.cart.delete.mockResolvedValue({});

    const result = await mergeGuestCart('guest-token', 'cust_1');

    expect(prisma.cart.delete).toHaveBeenCalledWith({
      where: { id: 'guest_cart' },
    });
    expect(result).toMatchObject({ id: 'cust_cart', currency: 'USD' });
    expect(prisma.cartLine.update).not.toHaveBeenCalled();
    expect(prisma.cartLine.create).not.toHaveBeenCalled();
  });

  it('returns null when guest cart is already claimed by a different customer', async () => {
    prisma.cart.findUnique.mockResolvedValue({
      id: 'guest_cart',
      token: 'guest-token',
      currency: 'USD',
      customerId: 'other_cust',
      lines: [],
    });

    const result = await mergeGuestCart('guest-token', 'cust_1');

    expect(result).toBeNull();
    expect(prisma.cart.findFirst).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// lockCart / unlockCart
// ---------------------------------------------------------------------------

describe('lockCart', () => {
  it('sets lockedAt to a Date', async () => {
    const before = Date.now();
    prisma.cart.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'cart_1', ...data })
    );

    const result = await lockCart('cart_1');

    expect(result.lockedAt).toBeInstanceOf(Date);
    expect(result.lockedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart_1' },
      data: { lockedAt: expect.any(Date) },
    });
  });
});

describe('unlockCart', () => {
  it('clears lockedAt to null', async () => {
    prisma.cart.update.mockResolvedValue({ id: 'cart_1', lockedAt: null });

    await unlockCart('cart_1');

    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart_1' },
      data: { lockedAt: null },
    });
  });
});

// ---------------------------------------------------------------------------
// expireCarts
// ---------------------------------------------------------------------------

describe('expireCarts', () => {
  it('calls deleteMany with expiresAt < now', async () => {
    const before = Date.now();
    prisma.cart.deleteMany.mockResolvedValue({ count: 3 });

    const result = await expireCarts();

    const call = prisma.cart.deleteMany.mock.calls[0][0];
    expect(call.where.expiresAt.lt).toBeInstanceOf(Date);
    expect(call.where.expiresAt.lt.getTime()).toBeGreaterThanOrEqual(
      before - 100
    );
    expect(call.where.checkouts).toEqual({ none: {} });
    expect(result.count).toBe(3);
  });
});
