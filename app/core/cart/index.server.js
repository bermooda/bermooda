// app/core/cart/index.server.js
// Cart service: creation, line management, currency lock, guest merge, expiry.

import { randomUUID } from 'crypto';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { queueEmit } from '#/core/events/job.server';
import {
  getCustomerGroupIds,
  resolveVariantPrice,
} from '#/core/pricing/index.server';

export { cartLineTotal, summarizeCartLines } from '#/core/cart/lines';

const CART_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

async function resolveTitleSnapshot(variantId, locale) {
  if (!locale) return variantId;

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

  return translation?.value ?? variantId;
}

async function rotateCartToken(cartId, extraData = {}) {
  return prisma.cart.update({
    where: { id: cartId },
    data: { token: randomUUID(), ...extraData },
  });
}

async function mergeLineIntoCart(cartId, guestLine, existingLines) {
  const match = existingLines.find((l) => l.variantId === guestLine.variantId);

  if (match) {
    return prisma.cartLine.update({
      where: { id: match.id },
      data: { quantity: match.quantity + guestLine.quantity },
    });
  }

  return prisma.cartLine.create({
    data: {
      cartId,
      variantId: guestLine.variantId,
      quantity: guestLine.quantity,
      priceCentsSnapshot: guestLine.priceCentsSnapshot,
      titleSnapshot: guestLine.titleSnapshot,
    },
  });
}

// ---------------------------------------------------------------------------
// createCart
// ---------------------------------------------------------------------------

/**
 * Create a new cart with a UUID token and ~30-day expiry.
 *
 * @param {{ currency?: string, customerId?: string, salesChannelId?: string }} [options]
 * @returns {Promise<object>} created Cart
 */
export async function createCart({
  currency = 'USD',
  customerId,
  salesChannelId,
} = {}) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + CART_EXPIRY_MS);

  const cart = await prisma.cart.create({
    data: {
      token,
      currency,
      customerId,
      expiresAt,
      salesChannelId: salesChannelId ?? null,
    },
  });

  await queueEmit('cart.created', {
    cartId: cart.id,
    token: cart.token,
    currency: cart.currency,
    customerId: cart.customerId,
    salesChannelId: cart.salesChannelId,
    expiresAt: cart.expiresAt,
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
// deleteCart
// ---------------------------------------------------------------------------

/**
 * Delete a cart by token.
 *
 * @param {string} token
 * @returns {Promise<boolean>} true when deleted, false when not found
 */
export async function deleteCart(token) {
  const cart = await prisma.cart.findUnique({ where: { token } });
  if (!cart) return false;

  await prisma.cart.delete({ where: { id: cart.id } });
  return true;
}

// ---------------------------------------------------------------------------
// addLine
// ---------------------------------------------------------------------------

export async function addLine(
  cartId,
  variantId,
  quantity,
  { currency, locale, customerId } = {}
) {
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart) {
    throw new Error('CART_NOT_FOUND');
  }

  // Enforce currency lock: caller-supplied currency must match the cart's currency.
  if (currency && cart.currency !== currency) {
    throw new Error('CURRENCY_MISMATCH');
  }

  const customerGroupIds = customerId
    ? await getCustomerGroupIds(customerId)
    : [];

  const titleSnapshot = await resolveTitleSnapshot(variantId, locale);

  // Upsert: increment quantity if a line already exists for this variant.
  const existing = await prisma.cartLine.findFirst({
    where: { cartId, variantId },
  });

  const lineQuantity = existing ? existing.quantity + quantity : quantity;
  const resolved = await resolveVariantPrice({
    variantId,
    currency: cart.currency,
    quantity: lineQuantity,
    customerGroupIds,
  });

  if (!resolved) {
    throw new Error('PRICE_NOT_FOUND');
  }

  const line = existing
    ? await prisma.cartLine.update({
        where: { id: existing.id },
        data: {
          quantity: lineQuantity,
          priceCentsSnapshot: resolved.priceCents,
        },
      })
    : await prisma.cartLine.create({
        data: {
          cartId,
          variantId,
          quantity: lineQuantity,
          priceCentsSnapshot: resolved.priceCents,
          titleSnapshot,
        },
      });

  await queueEmit('cart.itemAdded', {
    cartId,
    variantId,
    quantity,
    lineId: line.id,
  });

  return line;
}

// ---------------------------------------------------------------------------
// setCartCurrency
// ---------------------------------------------------------------------------

/**
 * Move a cart to another currency, repricing every line in it, so shoppers
 * can switch currency after adding items. All-or-nothing: when any line has
 * no price in `currency`, throws PRICE_NOT_FOUND and leaves the cart as is.
 *
 * @param {string} cartId
 * @param {string} currency
 * @returns {Promise<object>} updated Cart
 */
export async function setCartCurrency(cartId, currency) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { lines: true },
  });
  if (!cart) {
    throw new Error('CART_NOT_FOUND');
  }
  if (cart.currency === currency) return cart;

  const customerGroupIds = cart.customerId
    ? await getCustomerGroupIds(cart.customerId)
    : [];
  const repriced = await Promise.all(
    cart.lines.map(async (line) => {
      const resolved = await resolveVariantPrice({
        variantId: line.variantId,
        currency,
        quantity: line.quantity,
        customerGroupIds,
      });
      if (!resolved) {
        throw new Error('PRICE_NOT_FOUND');
      }
      return { id: line.id, priceCents: resolved.priceCents };
    })
  );

  const results = await prisma.$transaction([
    ...repriced.map((line) =>
      prisma.cartLine.update({
        where: { id: line.id },
        data: { priceCentsSnapshot: line.priceCents },
      })
    ),
    prisma.cart.update({ where: { id: cartId }, data: { currency } }),
  ]);

  await queueEmit('cart.updated', { cartId, currency });

  return results.at(-1);
}

// ---------------------------------------------------------------------------
// removeLine
// ---------------------------------------------------------------------------

export async function removeLine(cartId, lineId) {
  await prisma.cartLine.delete({ where: { id: lineId, cartId } });

  await queueEmit('cart.itemRemoved', {
    cartId,
    lineId,
  });
}

// ---------------------------------------------------------------------------
// updateQuantity
// ---------------------------------------------------------------------------

export async function updateQuantity(cartId, lineId, quantity) {
  if (quantity <= 0) {
    return removeLine(cartId, lineId);
  }

  const existingLine = await prisma.cartLine.findFirst({
    where: { id: lineId, cartId },
  });
  if (!existingLine) {
    throw new Error('LINE_NOT_FOUND');
  }

  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart) {
    throw new Error('CART_NOT_FOUND');
  }

  const customerGroupIds = cart.customerId
    ? await getCustomerGroupIds(cart.customerId)
    : [];
  const resolved = await resolveVariantPrice({
    variantId: existingLine.variantId,
    currency: cart.currency,
    quantity,
    customerGroupIds,
  });

  if (!resolved) {
    throw new Error('PRICE_NOT_FOUND');
  }

  const line = await prisma.cartLine.update({
    where: { id: lineId, cartId },
    data: {
      quantity,
      priceCentsSnapshot: resolved.priceCents,
    },
  });

  await queueEmit('cart.updated', {
    cartId,
    lineId: line.id,
    quantity: line.quantity,
  });

  return line;
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
    return rotateCartToken(guestCart.id, { customerId });
  }

  // Customer already has a cart — merge guest lines into it, then delete guest cart.
  if (guestCart.currency !== customerCart.currency) {
    // Cannot merge carts with different currencies; discard guest cart
    await prisma.cart.delete({ where: { id: guestCart.id } });
    return customerCart;
  }

  for (const guestLine of guestCart.lines) {
    await mergeLineIntoCart(customerCart.id, guestLine, customerCart.lines);
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });

  return rotateCartToken(customerCart.id);
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
