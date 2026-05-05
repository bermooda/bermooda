// app/core/cart/cart.test.server.js

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

import prisma from '#/libs/prisma.server';

import {
  createCart,
  getCart,
  addLine,
  removeLine,
  updateQuantity,
  mergeGuestCart,
  expireCarts,
  lockCart,
  unlockCart,
} from '#/core/cart/index.server';

beforeEach(() => {
  vi.clearAllMocks();
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
    prisma.variantPrice.findUnique.mockResolvedValue(null);

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
    prisma.variantPrice.findUnique.mockResolvedValue({ priceCents: 1000 });
    prisma.translation.findUnique.mockResolvedValue(null);
    prisma.cartLine.findFirst.mockResolvedValue({
      id: 'line_1',
      quantity: 2,
      variantId: 'variant_1',
    });
    prisma.cartLine.update.mockResolvedValue({ id: 'line_1', quantity: 5 });

    await addLine('cart_1', 'variant_1', 3, { locale: 'en' });

    expect(prisma.cartLine.update).toHaveBeenCalledWith({
      where: { id: 'line_1' },
      data: { quantity: { increment: 3 } },
    });
    expect(prisma.cartLine.create).not.toHaveBeenCalled();
  });

  it('creates a new line when no existing line for this variantId', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    prisma.variantPrice.findUnique.mockResolvedValue({ priceCents: 2500 });
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
  });

  it('falls back to variantId as titleSnapshot when no translation found', async () => {
    prisma.cart.findUnique.mockResolvedValue({ id: 'cart_1', currency: 'USD' });
    prisma.variantPrice.findUnique.mockResolvedValue({ priceCents: 999 });
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
    prisma.cartLine.update.mockResolvedValue({ id: 'line_1', quantity: 4 });

    await updateQuantity('cart_1', 'line_1', 4);

    expect(prisma.cartLine.update).toHaveBeenCalledWith({
      where: { id: 'line_1', cartId: 'cart_1' },
      data: { quantity: 4 },
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
