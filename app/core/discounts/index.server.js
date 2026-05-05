// app/core/discounts/index.server.js
// Discount engine: validation, application, CRUD, and listing.

import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Validate a discount record against the given parameters.
 * Throws a descriptive Error if any constraint is violated.
 * @param {object} discount - Prisma Discount record
 * @param {{ subtotalCents: number, currency: string }} params
 */
function validateDiscountRecord(discount, { subtotalCents, currency }) {
  if (!discount.active) {
    throw new Error('DISCOUNT_INACTIVE');
  }

  if (discount.expiresAt !== null && discount.expiresAt <= new Date()) {
    throw new Error('DISCOUNT_EXPIRED');
  }

  if (discount.maxUsesCount !== null && discount.usedCount >= discount.maxUsesCount) {
    throw new Error('DISCOUNT_MAX_USES_REACHED');
  }

  if (discount.minSubtotalCents !== null && subtotalCents < discount.minSubtotalCents) {
    throw new Error('DISCOUNT_MIN_SUBTOTAL_NOT_MET');
  }

  if (discount.currency !== null && discount.currency !== currency) {
    throw new Error('DISCOUNT_CURRENCY_MISMATCH');
  }
}

/**
 * Calculate the discount amount in cents.
 * @param {object} discount - Prisma Discount record
 * @param {number} subtotalCents
 * @returns {number} discountCents
 */
function calculateDiscountCents(discount, subtotalCents) {
  if (discount.type === 'percent') {
    return Math.round(subtotalCents * discount.value / 100);
  }
  // fixed: cap at subtotal so the discount can't exceed the order total
  return Math.min(discount.value, subtotalCents);
}

// ---------------------------------------------------------------------------
// applyDiscount
// ---------------------------------------------------------------------------

/**
 * Validate a discount code and atomically increment its usedCount.
 * @param {string} code
 * @param {{ subtotalCents: number, currency: string }} params
 * @returns {Promise<{ discountCents: number, code: string, type: string, value: number }>}
 */
export async function applyDiscount(code, { subtotalCents, currency }) {
  const discount = await prisma.discount.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  });

  if (!discount) {
    throw new Error('DISCOUNT_NOT_FOUND');
  }

  validateDiscountRecord(discount, { subtotalCents, currency });

  const discountCents = calculateDiscountCents(discount, subtotalCents);

  // Atomically increment usedCount — never read-then-write.
  await prisma.discount.update({
    where: { id: discount.id },
    data: { usedCount: { increment: 1 } },
  });

  return { discountCents, code: discount.code, type: discount.type, value: discount.value };
}

// ---------------------------------------------------------------------------
// validateDiscount
// ---------------------------------------------------------------------------

/**
 * Validate a discount code without incrementing usedCount.
 * Use at checkout review step before final order placement.
 * @param {string} code
 * @param {{ subtotalCents: number, currency: string }} params
 * @returns {Promise<object>} discount record with calculated discountCents
 */
export async function validateDiscount(code, { subtotalCents, currency }) {
  const discount = await prisma.discount.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  });

  if (!discount) {
    throw new Error('DISCOUNT_NOT_FOUND');
  }

  validateDiscountRecord(discount, { subtotalCents, currency });

  const discountCents = calculateDiscountCents(discount, subtotalCents);

  return { ...discount, discountCents };
}

// ---------------------------------------------------------------------------
// getDiscount
// ---------------------------------------------------------------------------

/**
 * Fetch a discount by code. Returns null if not found.
 * @param {string} code
 * @returns {Promise<object|null>}
 */
export async function getDiscount(code) {
  return prisma.discount.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  });
}

// ---------------------------------------------------------------------------
// createDiscount
// ---------------------------------------------------------------------------

/**
 * Create a new discount.
 * @param {{ code: string, type: string, value: number, minSubtotalCents?: number, maxUsesCount?: number, currency?: string, expiresAt?: Date, active?: boolean }} data
 * @returns {Promise<object>} created discount
 */
export async function createDiscount(data) {
  return prisma.discount.create({ data });
}

// ---------------------------------------------------------------------------
// updateDiscount
// ---------------------------------------------------------------------------

/**
 * Update discount fields by id.
 * @param {string} id
 * @param {object} data
 * @returns {Promise<object>} updated discount
 */
export async function updateDiscount(id, data) {
  return prisma.discount.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// deleteDiscount
// ---------------------------------------------------------------------------

/**
 * Delete a discount by id.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteDiscount(id) {
  await prisma.discount.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// listDiscounts
// ---------------------------------------------------------------------------

/**
 * List discounts with optional active filter and pagination.
 * @param {{ active?: boolean, page?: number, limit?: number }} options
 * @returns {Promise<object[]>}
 */
export async function listDiscounts({ active, page = 1, limit = 20 } = {}) {
  const where = {};
  if (active !== undefined) where.active = active;

  const skip = (page - 1) * limit;

  return prisma.discount.findMany({
    where,
    skip,
    take: limit,
    orderBy: { code: 'asc' },
  });
}
