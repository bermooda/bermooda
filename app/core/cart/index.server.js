// app/core/cart/index.server.js
// Cart service: creation, line management, currency lock, guest merge, expiry.

import { randomUUID } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// createCart
// ---------------------------------------------------------------------------

export async function createCart({ currency = 'USD', customerId } = {}) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const cart = await prisma.cart.create({
    data: { token, currency, customerId, expiresAt },
  });

  logger.info({ cartId: cart.id }, 'cart created');
  return cart;
}

// ---------------------------------------------------------------------------
// getCart
// ---------------------------------------------------------------------------

export async function getCart(token) {
  return prisma.cart.findUnique({
    where: { token },
    include: {
      lines: {
        include: { variant: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// addLine
// ---------------------------------------------------------------------------

export async function addLine(
  cartId,
  variantId,
  quantity,
  { currency, locale } = {}
) {
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });

  // Enforce currency lock: caller-supplied currency must match the cart's currency.
  if (currency && cart.currency !== currency) {
    throw new Error('CURRENCY_MISMATCH');
  }

  const priceRow = await prisma.variantPrice.findUnique({
    where: { variantId_currency: { variantId, currency: cart.currency } },
  });

  if (!priceRow) {
    throw new Error('PRICE_NOT_FOUND');
  }

  // Resolve title from Translation; fall back to variantId.
  let titleSnapshot = variantId;
  if (locale) {
    const translation = await prisma.translation.findUnique({
      where: {
        entityType_entityId_locale_field: {
          entityType: 'variant',
          entityId: variantId,
          locale,
          field: 'title',
        },
      },
    });
    if (translation) titleSnapshot = translation.value;
  }

  // Upsert: increment quantity if a line already exists for this variant.
  const existing = await prisma.cartLine.findFirst({
    where: { cartId, variantId },
  });

  if (existing) {
    return prisma.cartLine.update({
      where: { id: existing.id },
      data: { quantity: { increment: quantity } },
    });
  }

  return prisma.cartLine.create({
    data: {
      cartId,
      variantId,
      quantity,
      priceCentsSnapshot: priceRow.priceCents,
      titleSnapshot,
    },
  });
}

// ---------------------------------------------------------------------------
// removeLine
// ---------------------------------------------------------------------------

export async function removeLine(cartId, lineId) {
  await prisma.cartLine.delete({ where: { id: lineId, cartId } });
}

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------

export async function updateQuantity(cartId, lineId, quantity) {
  if (quantity <= 0) {
    return removeLine(cartId, lineId);
  }

  return prisma.cartLine.update({
    where: { id: lineId, cartId },
    data: { quantity },
  });
}

// ---------------------------------------------------------------------------
// mergeGuestCart
// ---------------------------------------------------------------------------

export async function mergeGuestCart(guestToken, customerId) {
  const guestCart = await prisma.cart.findUnique({
    where: { token: guestToken },
    include: { lines: true },
  });

  if (!guestCart) return null;

  if (guestCart.customerId && guestCart.customerId !== customerId) {
    return null; // cart already belongs to another customer
  }

  const customerCart = await prisma.cart.findFirst({
    where: { customerId, lockedAt: null },
    include: { lines: true },
  });

  if (!customerCart) {
    // No existing customer cart — reassign guest cart, rotate token.
    const newToken = randomUUID();
    return prisma.cart.update({
      where: { id: guestCart.id },
      data: { customerId, token: newToken },
    });
  }

  // Customer already has a cart — merge guest lines into it, then delete guest cart.
  if (guestCart.currency !== customerCart.currency) {
    // Cannot merge carts with different currencies; discard guest cart
    await prisma.cart.delete({ where: { id: guestCart.id } });
    return customerCart;
  }

  for (const guestLine of guestCart.lines) {
    const match = customerCart.lines.find(
      (l) => l.variantId === guestLine.variantId
    );
    if (match) {
      await prisma.cartLine.update({
        where: { id: match.id },
        data: { quantity: match.quantity + guestLine.quantity },
      });
    } else {
      await prisma.cartLine.create({
        data: {
          cartId: customerCart.id,
          variantId: guestLine.variantId,
          quantity: guestLine.quantity,
          priceCentsSnapshot: guestLine.priceCentsSnapshot,
          titleSnapshot: guestLine.titleSnapshot,
        },
      });
    }
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });

  // Rotate token on surviving customer cart.
  const newToken = randomUUID();
  return prisma.cart.update({
    where: { id: customerCart.id },
    data: { token: newToken },
  });
}

// ---------------------------------------------------------------------------
// expireCarts
// ---------------------------------------------------------------------------

export async function expireCarts() {
  // skip carts with active checkouts to avoid FK constraint violations
  const result = await prisma.cart.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      checkouts: { none: {} },
    },
  });
  logger.info({ count: result.count }, 'expired carts deleted');
  return result;
}

// ---------------------------------------------------------------------------
// lockCart / unlockCart
// ---------------------------------------------------------------------------

export async function lockCart(cartId) {
  return prisma.cart.update({
    where: { id: cartId },
    data: { lockedAt: new Date() },
  });
}

export async function unlockCart(cartId) {
  return prisma.cart.update({
    where: { id: cartId },
    data: { lockedAt: null },
  });
}
