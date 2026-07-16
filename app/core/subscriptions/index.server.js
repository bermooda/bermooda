// app/core/subscriptions/index.server.js
// Recurring billing foundation (Stripe subscription mode).

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import {
  parseListPagination,
  readQueryParam,
} from '#/libs/prisma/pagination.server';
import { listRecentVariantsForInventory } from '#/core/inventory/index.server';

export const SUBSCRIPTION_INTERVALS = ['day', 'week', 'month', 'year'];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'cancelled',
  'past_due',
  'paused',
];

export const DEFAULT_PLAN_LIST_LIMIT = 20;
export const MAX_PLAN_LIST_RESULTS = 100;

export const DEFAULT_SUBSCRIPTION_LIST_LIMIT = 20;
export const MAX_SUBSCRIPTION_LIST_RESULTS = 100;

const SUBSCRIPTION_INTERVAL_SET = new Set(SUBSCRIPTION_INTERVALS);
const SUBSCRIPTION_STATUS_SET = new Set(SUBSCRIPTION_STATUSES);

const PLAN_LIST_INCLUDE = {
  variant: { select: { id: true, sku: true, productId: true } },
};

const PLAN_DETAIL_INCLUDE = {
  variant: {
    select: {
      id: true,
      sku: true,
      productId: true,
      product: { select: { id: true, title: true } },
    },
  },
};

const SUBSCRIPTION_LIST_INCLUDE = {
  plan: {
    select: { id: true, name: true, interval: true, intervalCount: true },
  },
  customer: { select: { id: true, email: true, name: true } },
};

const SUBSCRIPTION_DETAIL_INCLUDE = {
  plan: {
    select: {
      id: true,
      name: true,
      interval: true,
      intervalCount: true,
      active: true,
    },
  },
  customer: { select: { id: true, email: true, name: true } },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Parse subscription plan list query params.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parsePlanListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_PLAN_LIST_LIMIT,
    max: MAX_PLAN_LIST_RESULTS,
  });

  const activeOnlyRaw = readQueryParam(source, 'activeOnly');
  const activeOnly =
    activeOnlyRaw === undefined
      ? undefined
      : activeOnlyRaw === 'true' || activeOnlyRaw === '1';

  return {
    page,
    limit,
    ...(activeOnly !== undefined ? { activeOnly } : {}),
  };
}

/**
 * Build a Prisma where clause for subscription plan list filters.
 *
 * @param {{ activeOnly?: boolean }} filters
 */
export function buildPlanWhere({ activeOnly } = {}) {
  if (activeOnly === false) return {};
  if (activeOnly === true) return { active: true };
  return {};
}

/**
 * Parse admin/API create-plan payload.
 *
 * @param {object} input
 */
export function parseCreatePlanInput(input = {}) {
  const name = input.name?.toString().trim();
  const variantId = input.variantId?.toString().trim() || null;
  const interval = input.interval?.toString().trim() ?? 'month';
  const intervalCount =
    typeof input.intervalCount === 'number'
      ? input.intervalCount
      : parseInt(String(input.intervalCount ?? '1'), 10);

  if (!name) {
    throw Object.assign(new Error('Plan name is required.'), {
      code: 'PLAN_NAME_REQUIRED',
    });
  }

  if (!SUBSCRIPTION_INTERVAL_SET.has(interval)) {
    throw Object.assign(new Error('Invalid subscription interval.'), {
      code: 'INVALID_SUBSCRIPTION_INTERVAL',
    });
  }

  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw Object.assign(new Error('intervalCount must be at least 1.'), {
      code: 'INVALID_INTERVAL_COUNT',
    });
  }

  return {
    name,
    variantId,
    interval,
    intervalCount,
  };
}

/**
 * Parse admin form create-plan submission.
 *
 * @param {FormData} formData
 */
export function parseCreatePlanFromForm(formData) {
  return parseCreatePlanInput({
    name: formData.get('name'),
    variantId: formData.get('variantId'),
    interval: formData.get('interval'),
    intervalCount: formData.get('intervalCount'),
  });
}

/**
 * Parse admin/API update-plan payload.
 *
 * @param {object} input
 */
export function parseUpdatePlanInput(input = {}) {
  const data = {};

  if (input.name !== undefined) {
    const name = input.name?.toString().trim();
    if (!name) {
      throw Object.assign(new Error('Plan name is required.'), {
        code: 'PLAN_NAME_REQUIRED',
      });
    }
    data.name = name;
  }

  if (input.active !== undefined) {
    data.active = Boolean(input.active);
  }

  if (input.interval !== undefined) {
    const interval = input.interval?.toString().trim();
    if (!SUBSCRIPTION_INTERVAL_SET.has(interval)) {
      throw Object.assign(new Error('Invalid subscription interval.'), {
        code: 'INVALID_SUBSCRIPTION_INTERVAL',
      });
    }
    data.interval = interval;
  }

  if (input.intervalCount !== undefined) {
    const intervalCount =
      typeof input.intervalCount === 'number'
        ? input.intervalCount
        : parseInt(String(input.intervalCount), 10);
    if (!Number.isInteger(intervalCount) || intervalCount < 1) {
      throw Object.assign(new Error('intervalCount must be at least 1.'), {
        code: 'INVALID_INTERVAL_COUNT',
      });
    }
    data.intervalCount = intervalCount;
  }

  if (Object.keys(data).length === 0) {
    throw Object.assign(new Error('No plan fields to update.'), {
      code: 'PLAN_UPDATE_EMPTY',
    });
  }

  return data;
}

/**
 * Parse customer subscription list query params.
 *
 * @param {URLSearchParams|Record<string, string|undefined|null>} [source]
 */
export function parseSubscriptionListParams(source = {}) {
  const { page, limit } = parseListPagination(source, {
    limit: DEFAULT_SUBSCRIPTION_LIST_LIMIT,
    max: MAX_SUBSCRIPTION_LIST_RESULTS,
  });

  const customerId = readQueryParam(source, 'customerId')?.trim();
  const planId = readQueryParam(source, 'planId')?.trim();
  const status = readQueryParam(source, 'status')?.trim();

  if (status && !SUBSCRIPTION_STATUS_SET.has(status)) {
    throw Object.assign(new Error('Invalid subscription status filter.'), {
      code: 'INVALID_SUBSCRIPTION_STATUS',
    });
  }

  return {
    page,
    limit,
    ...(customerId ? { customerId } : {}),
    ...(planId ? { planId } : {}),
    ...(status ? { status } : {}),
  };
}

/**
 * Build a Prisma where clause for subscription list filters.
 *
 * @param {{ customerId?: string, planId?: string, status?: string }} filters
 */
export function buildSubscriptionWhere({ customerId, planId, status } = {}) {
  const where = {};
  if (customerId) where.customerId = customerId;
  if (planId) where.planId = planId;
  if (status) where.status = status;
  return where;
}

/**
 * Parse admin/API create-subscription payload.
 *
 * @param {object} input
 */
export function parseCreateSubscriptionInput(input = {}) {
  const customerId = input.customerId?.toString().trim();
  const planId = input.planId?.toString().trim();
  const externalSubscriptionId =
    input.externalSubscriptionId?.toString().trim() || null;

  let currentPeriodEnd = null;
  if (input.currentPeriodEnd) {
    const parsed =
      input.currentPeriodEnd instanceof Date
        ? input.currentPeriodEnd
        : new Date(input.currentPeriodEnd);
    if (!Number.isNaN(parsed.getTime())) {
      currentPeriodEnd = parsed;
    }
  }

  if (!customerId) {
    throw Object.assign(new Error('customerId is required.'), {
      code: 'CUSTOMER_ID_REQUIRED',
    });
  }

  if (!planId) {
    throw Object.assign(new Error('planId is required.'), {
      code: 'PLAN_ID_REQUIRED',
    });
  }

  return {
    customerId,
    planId,
    externalSubscriptionId,
    currentPeriodEnd,
  };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a subscription plan for admin/API responses.
 *
 * @param {object} record
 */
export function serializePlan(record) {
  return {
    id: record.id,
    name: record.name,
    variantId: record.variantId ?? null,
    interval: record.interval,
    intervalCount: record.intervalCount,
    active: record.active,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    variant: record.variant
      ? {
          id: record.variant.id,
          sku: record.variant.sku ?? null,
          productId: record.variant.productId ?? null,
          productTitle: record.variant.product?.title ?? null,
        }
      : undefined,
  };
}

/**
 * Serialize a customer subscription for admin/API responses.
 *
 * @param {object} record
 */
export function serializeSubscription(record) {
  return {
    id: record.id,
    customerId: record.customerId,
    planId: record.planId,
    status: record.status,
    externalSubscriptionId: record.externalSubscriptionId ?? null,
    currentPeriodEnd:
      record.currentPeriodEnd?.toISOString?.() ??
      record.currentPeriodEnd ??
      null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    plan: record.plan
      ? {
          id: record.plan.id,
          name: record.plan.name,
          interval: record.plan.interval,
          intervalCount: record.plan.intervalCount,
          active: record.plan.active,
        }
      : undefined,
    customer: record.customer
      ? {
          id: record.customer.id,
          email: record.customer.email ?? null,
          name: record.customer.name ?? null,
        }
      : undefined,
  };
}

function throwPlanNotFound(planId) {
  throw Object.assign(new Error('Subscription plan not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    planId,
  });
}

function throwSubscriptionNotFound(subscriptionId) {
  throw Object.assign(new Error('Subscription not found.'), {
    code: 'NOT_FOUND',
    status: 404,
    subscriptionId,
  });
}

async function requirePlanRecord(planId, include = PLAN_DETAIL_INCLUDE) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
    include,
  });
  if (!plan) throwPlanNotFound(planId);
  return plan;
}

async function requireSubscriptionRecord(
  subscriptionId,
  include = SUBSCRIPTION_DETAIL_INCLUDE
) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include,
  });
  if (!subscription) throwSubscriptionNotFound(subscriptionId);
  return subscription;
}

// ---------------------------------------------------------------------------
// Admin loaders
// ---------------------------------------------------------------------------

/**
 * Load data for the admin subscription plans index page.
 */
export async function loadSubscriptionPlanAdminData() {
  const [{ plans, total, page, limit }, variants] = await Promise.all([
    listSubscriptionPlans({ activeOnly: false, limit: 100 }),
    listRecentVariantsForInventory({ take: 50 }),
  ]);

  return { plans, total, page, limit, variants };
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/**
 * List subscription plans with optional pagination.
 *
 * @param {{
 *   activeOnly?: boolean,
 *   page?: number,
 *   limit?: number,
 * }} [options]
 */
export async function listSubscriptionPlans(options = {}) {
  const params =
    options.page != null || options.limit != null || options.activeOnly != null
      ? options
      : parsePlanListParams(options);

  const safePage = Math.max(1, params.page ?? 1);
  const safeLimit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_PLAN_LIST_LIMIT),
    MAX_PLAN_LIST_RESULTS
  );
  const skip = (safePage - 1) * safeLimit;
  const where = buildPlanWhere({
    activeOnly: params.activeOnly ?? true,
  });

  const [items, total] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where,
      include: PLAN_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.subscriptionPlan.count({ where }),
  ]);

  return {
    plans: items.map(serializePlan),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

export async function getSubscriptionPlan(planId) {
  const plan = await requirePlanRecord(planId);
  return serializePlan(plan);
}

export async function createSubscriptionPlan(input) {
  const data = parseCreatePlanInput(input);

  if (data.variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: data.variantId },
      select: { id: true },
    });
    if (!variant) {
      throw Object.assign(new Error('Product variant not found.'), {
        code: 'VARIANT_NOT_FOUND',
        status: 404,
      });
    }
  }

  const plan = await prisma.subscriptionPlan.create({
    data: { ...data, active: true },
    include: PLAN_DETAIL_INCLUDE,
  });

  logger.info({ planId: plan.id }, 'subscription plan created');
  return serializePlan(plan);
}

export async function updateSubscriptionPlan(planId, input) {
  await requirePlanRecord(planId, { variant: false });
  const data = parseUpdatePlanInput(input);

  const plan = await prisma.subscriptionPlan.update({
    where: { id: planId },
    data,
    include: PLAN_DETAIL_INCLUDE,
  });

  logger.info({ planId }, 'subscription plan updated');
  return serializePlan(plan);
}

// ---------------------------------------------------------------------------
// Customer subscriptions
// ---------------------------------------------------------------------------

/**
 * List customer subscriptions with optional filters and pagination.
 *
 * @param {{
 *   customerId?: string,
 *   planId?: string,
 *   status?: string,
 *   page?: number,
 *   limit?: number,
 * }} [options]
 */
export async function listSubscriptions(options = {}) {
  const params =
    options.page != null || options.limit != null
      ? options
      : parseSubscriptionListParams(options);

  const safePage = Math.max(1, params.page ?? 1);
  const safeLimit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_SUBSCRIPTION_LIST_LIMIT),
    MAX_SUBSCRIPTION_LIST_RESULTS
  );
  const skip = (safePage - 1) * safeLimit;
  const where = buildSubscriptionWhere(params);

  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: SUBSCRIPTION_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    subscriptions: items.map(serializeSubscription),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}

export async function getSubscription(subscriptionId) {
  const subscription = await requireSubscriptionRecord(subscriptionId);
  return serializeSubscription(subscription);
}

export async function createSubscription(input) {
  const data = parseCreateSubscriptionInput(input);

  await requirePlanRecord(data.planId, { variant: false });

  const customer = await prisma.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true },
  });
  if (!customer) {
    throw Object.assign(new Error('Customer not found.'), {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  const subscription = await prisma.subscription.create({
    data: {
      ...data,
      status: 'active',
    },
    include: SUBSCRIPTION_DETAIL_INCLUDE,
  });

  logger.info(
    { subscriptionId: subscription.id, customerId: data.customerId },
    'subscription created'
  );
  return serializeSubscription(subscription);
}

export async function cancelSubscription(id) {
  await requireSubscriptionRecord(id, { plan: false, customer: false });

  const subscription = await prisma.subscription.update({
    where: { id },
    data: { status: 'cancelled' },
    include: SUBSCRIPTION_DETAIL_INCLUDE,
  });

  logger.info({ subscriptionId: id }, 'subscription cancelled');
  return serializeSubscription(subscription);
}
