// app/core/discounts/index.server.js
// Promotions engine: validation, stacking, automatic discounts, CRUD.

import prisma from '#/libs/prisma.server';
import { equalsFilter } from '#/libs/prisma/filters/index.server';
import { summarizeCartLines } from '#/core/cart/lines';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getDiscountLifecycleError(discount, now = new Date()) {
  if (!discount.active) return 'DISCOUNT_INACTIVE';
  if (discount.startsAt && discount.startsAt > now) {
    return 'DISCOUNT_NOT_STARTED';
  }
  if (discount.expiresAt !== null && discount.expiresAt <= now) {
    return 'DISCOUNT_EXPIRED';
  }
  if (
    discount.maxUsesCount !== null &&
    discount.usedCount >= discount.maxUsesCount
  ) {
    return 'DISCOUNT_MAX_USES_REACHED';
  }
  return null;
}

function isDiscountActive(discount, now = new Date()) {
  return getDiscountLifecycleError(discount, now) === null;
}

function validateDiscountConstraints(
  discount,
  { subtotalCents, currency, totalQuantity = 0, customerGroupId = null },
  now = new Date()
) {
  const lifecycleError = getDiscountLifecycleError(discount, now);
  if (lifecycleError) {
    throw new Error(lifecycleError);
  }

  if (
    discount.minSubtotalCents !== null &&
    subtotalCents < discount.minSubtotalCents
  ) {
    throw new Error('DISCOUNT_MIN_SUBTOTAL_NOT_MET');
  }

  if (discount.minQuantity !== null && totalQuantity < discount.minQuantity) {
    throw new Error('DISCOUNT_MIN_QUANTITY_NOT_MET');
  }

  if (discount.currency !== null && discount.currency !== currency) {
    throw new Error('DISCOUNT_CURRENCY_MISMATCH');
  }

  if (
    discount.customerGroupId &&
    customerGroupId &&
    discount.customerGroupId !== customerGroupId
  ) {
    throw new Error('DISCOUNT_CUSTOMER_GROUP_MISMATCH');
  }
}

async function findDiscountByCode(code) {
  return prisma.discount.findFirst({
    where: { code: equalsFilter(code) },
  });
}

/**
 * @param {object} discount
 * @param {number} subtotalCents
 * @param {object[]} lines
 * @returns {{ discountCents: number, freeShipping: boolean }}
 */
function calculateDiscountAmount(discount, subtotalCents, lines = []) {
  if (discount.type === 'free_shipping') {
    return { discountCents: 0, freeShipping: true };
  }

  if (discount.type === 'bogo') {
    let rules = {};
    try {
      rules = discount.rulesJson ? JSON.parse(discount.rulesJson) : {};
    } catch {
      rules = {};
    }
    const buyQty = rules.buyQuantity ?? 2;
    const getQty = rules.getQuantity ?? 1;
    const getPercent = rules.getDiscountPercent ?? 100;

    const { totalQuantity: totalQty } = summarizeCartLines(lines);
    const sets = Math.floor(totalQty / (buyQty + getQty));
    if (sets <= 0) return { discountCents: 0, freeShipping: false };

    const cheapest = [...lines].sort(
      (a, b) => a.priceCentsSnapshot - b.priceCentsSnapshot
    )[0];
    if (!cheapest) return { discountCents: 0, freeShipping: false };

    const freeUnits = sets * getQty;
    const discountCents = Math.round(
      (cheapest.priceCentsSnapshot * freeUnits * getPercent) / 100
    );
    return { discountCents, freeShipping: false };
  }

  if (discount.type === 'percent') {
    return {
      discountCents: Math.round((subtotalCents * discount.value) / 100),
      freeShipping: false,
    };
  }

  // fixed
  return {
    discountCents: Math.min(discount.value, subtotalCents),
    freeShipping: false,
  };
}

/**
 * Apply stacking rules to candidate discounts.
 * Non-stackable: keep only the single best discount.
 * Stackable: accumulate by priority until subtotal is exhausted.
 *
 * @param {object[]} candidates - each has discountCents, freeShipping, stackable, priority
 * @param {number} subtotalCents
 */
function applyStackingRules(candidates, subtotalCents) {
  if (candidates.length === 0) {
    return { applied: [], discountCents: 0, freeShipping: false };
  }

  const nonStackable = candidates.filter((c) => !c.stackable);
  const stackable = candidates.filter((c) => c.stackable);

  let applied = [];
  let remaining = subtotalCents;
  let totalDiscount = 0;
  let freeShipping = false;

  if (nonStackable.length > 0) {
    const best = nonStackable.reduce((a, b) =>
      a.discountCents >= b.discountCents ? a : b
    );
    applied.push(best);
    totalDiscount += best.discountCents;
    remaining -= best.discountCents;
    if (best.freeShipping) freeShipping = true;
  }

  const sortedStackable = [...stackable].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );

  for (const candidate of sortedStackable) {
    const capped = Math.min(candidate.discountCents, remaining);
    if (capped <= 0 && !candidate.freeShipping) continue;

    applied.push({ ...candidate, discountCents: capped });
    totalDiscount += capped;
    remaining -= capped;
    if (candidate.freeShipping) freeShipping = true;
  }

  return { applied, discountCents: totalDiscount, freeShipping };
}

// ---------------------------------------------------------------------------
// resolvePromotions — totals engine entry point
// ---------------------------------------------------------------------------

/**
 * Resolve all applicable promotions for a cart/checkout state.
 *
 * @param {{
 *   cart: object,
 *   couponCodes?: string[],
 *   couponCode?: string,
 *   customerGroupId?: string,
 * }} params
 * @returns {Promise<{
 *   applied: object[],
 *   discountCents: number,
 *   freeShipping: boolean,
 *   primaryCode: string|null
 * }>}
 */
export async function resolvePromotions({
  cart,
  couponCodes = [],
  couponCode,
  customerGroupId = null,
}) {
  const lines = cart?.lines ?? [];
  const { subtotalCents, totalQuantity } = summarizeCartLines(lines);
  const currency = cart?.currency ?? 'USD';

  const codes = new Set(
    [...couponCodes, couponCode].filter(Boolean).map((c) => c.toUpperCase())
  );

  const [automaticDiscounts, codeDiscounts] = await Promise.all([
    prisma.discount.findMany({
      where: { automatic: true, active: true },
      orderBy: { priority: 'desc' },
    }),
    codes.size > 0
      ? prisma.discount.findMany({
          where: {
            code: { in: [...codes] },
            active: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const seen = new Set();
  const candidates = [];

  const allDiscounts = [...automaticDiscounts, ...codeDiscounts];

  for (const discount of allDiscounts) {
    if (!discount || seen.has(discount.id)) continue;
    seen.add(discount.id);

    try {
      validateDiscountConstraints(discount, {
        subtotalCents,
        currency,
        totalQuantity,
        customerGroupId,
      });
    } catch {
      continue;
    }

    const { discountCents, freeShipping } = calculateDiscountAmount(
      discount,
      subtotalCents,
      lines
    );

    if (discountCents <= 0 && !freeShipping) continue;

    candidates.push({
      discountId: discount.id,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      discountCents,
      freeShipping,
      stackable: discount.stackable,
      priority: discount.priority ?? 0,
      automatic: discount.automatic,
    });
  }

  const { applied, discountCents, freeShipping } = applyStackingRules(
    candidates,
    subtotalCents
  );

  const primaryCode = applied.find((a) => a.code)?.code ?? null;

  return { applied, discountCents, freeShipping, primaryCode };
}

/**
 * Persist applied promotions on an order inside a transaction.
 *
 * @param {string} orderId
 * @param {object[]} applied
 * @param {object} tx - Prisma transaction client
 */
export async function persistOrderDiscounts(orderId, applied, tx) {
  for (const item of applied) {
    await tx.orderDiscount.create({
      data: {
        orderId,
        discountId: item.discountId,
        code: item.code ?? null,
        type: item.type,
        value: item.value,
        discountCents: item.discountCents,
      },
    });

    await tx.discount.update({
      where: { id: item.discountId },
      data: { usedCount: { increment: 1 } },
    });
  }
}

// ---------------------------------------------------------------------------
// validateDiscount
// ---------------------------------------------------------------------------

export async function validateDiscount(code, { subtotalCents, currency }) {
  const discount = await findDiscountByCode(code);
  if (!discount) {
    throw new Error('DISCOUNT_NOT_FOUND');
  }

  validateDiscountConstraints(discount, { subtotalCents, currency });

  const { discountCents } = calculateDiscountAmount(discount, subtotalCents);

  return { ...discount, discountCents };
}

// ---------------------------------------------------------------------------
// getDiscount
// ---------------------------------------------------------------------------

export async function getDiscount(codeOrId) {
  const byCode = await findDiscountByCode(codeOrId);
  if (byCode) return byCode;

  return prisma.discount.findUnique({ where: { id: codeOrId } }) ?? null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createDiscount(data) {
  return prisma.discount.create({ data });
}

export async function updateDiscount(id, data) {
  return prisma.discount.update({ where: { id }, data });
}

export async function deleteDiscount(id) {
  await prisma.discount.delete({ where: { id } });
}

export async function listDiscounts({
  active,
  page = 1,
  limit = 20,
  orderBy = { code: 'asc' },
} = {}) {
  const where = {};
  if (active !== undefined) where.active = active;

  const skip = (page - 1) * limit;

  const [discounts, total] = await Promise.all([
    prisma.discount.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
    prisma.discount.count({ where }),
  ]);

  return { discounts, total };
}

/**
 * Parse admin discount create/update form fields.
 *
 * @param {FormData} formData
 * @param {{ active?: boolean }} [opts]
 * @returns {{ data: object } | { error: string }}
 */
export function parseDiscountFormData(formData, { active } = {}) {
  const code = formData.get('code')?.toString().trim().toUpperCase() ?? '';
  const type = formData.get('type')?.toString() ?? '';
  const value = parseInt(formData.get('value') ?? '0', 10);
  const minSubtotalCents = formData.get('minSubtotalCents')?.toString().trim()
    ? parseInt(formData.get('minSubtotalCents'), 10)
    : null;
  const maxUsesCount = formData.get('maxUsesCount')?.toString().trim()
    ? parseInt(formData.get('maxUsesCount'), 10)
    : null;
  const currency = formData.get('currency')?.toString().trim() || null;
  const expiresAtRaw = formData.get('expiresAt')?.toString().trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

  if (!code) return { error: 'Code is required.' };
  if (!type) return { error: 'Type is required.' };
  if (!value || value <= 0) {
    return { error: 'Value must be greater than 0.' };
  }
  if (type === 'fixed' && !currency) {
    return { error: 'Currency is required for fixed discounts.' };
  }

  return {
    data: {
      code,
      type,
      value,
      minSubtotalCents,
      maxUsesCount,
      currency: type === 'fixed' ? currency : null,
      expiresAt,
      ...(active !== undefined ? { active } : {}),
    },
  };
}

/**
 * Toggle a discount's active flag.
 *
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function toggleDiscountActive(id) {
  const current = await getDiscount(id);
  if (!current) {
    const err = new Error('Discount not found');
    err.code = 'DISCOUNT_NOT_FOUND';
    throw err;
  }

  return updateDiscount(id, { active: !current.active });
}

// Exported for testing
export {
  calculateDiscountAmount,
  applyStackingRules,
  validateDiscountConstraints,
  isDiscountActive,
  getDiscountLifecycleError,
};
