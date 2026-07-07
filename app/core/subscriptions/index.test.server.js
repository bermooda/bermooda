// app/core/subscriptions/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    subscriptionPlan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productVariant: { findUnique: vi.fn() },
    customer: { findUnique: vi.fn() },
  },
}));

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('#/core/inventory/index.server', () => ({
  listRecentVariantsForInventory: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import {
  buildPlanWhere,
  buildSubscriptionWhere,
  cancelSubscription,
  createSubscription,
  createSubscriptionPlan,
  getSubscription,
  getSubscriptionPlan,
  listSubscriptionPlans,
  listSubscriptions,
  parseCreatePlanFromForm,
  parseCreatePlanInput,
  parseCreateSubscriptionInput,
  parsePlanListParams,
  parseSubscriptionListParams,
  parseUpdatePlanInput,
  serializePlan,
  serializeSubscription,
  SUBSCRIPTION_INTERVALS,
  SUBSCRIPTION_STATUSES,
  updateSubscriptionPlan,
} from '#/core/subscriptions/index.server';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parsePlanListParams', () => {
  it('parses pagination and activeOnly filter', () => {
    const params = parsePlanListParams(
      new URLSearchParams('page=2&limit=10&activeOnly=false')
    );
    expect(params).toEqual({
      page: 2,
      limit: 10,
      activeOnly: false,
    });
  });
});

describe('buildPlanWhere', () => {
  it('returns empty where when activeOnly is false', () => {
    expect(buildPlanWhere({ activeOnly: false })).toEqual({});
  });

  it('filters to active plans when activeOnly is true', () => {
    expect(buildPlanWhere({ activeOnly: true })).toEqual({ active: true });
  });
});

describe('parseCreatePlanInput', () => {
  it('validates name and interval', () => {
    expect(() =>
      parseCreatePlanInput({ name: '  ', interval: 'month' })
    ).toThrow('Plan name is required');

    expect(() =>
      parseCreatePlanInput({ name: 'Monthly', interval: 'bogus' })
    ).toThrow('Invalid subscription interval');
  });

  it('normalizes create payload', () => {
    expect(
      parseCreatePlanInput({
        name: ' Monthly ',
        variantId: 'var_1',
        interval: 'month',
        intervalCount: 2,
      })
    ).toEqual({
      name: 'Monthly',
      variantId: 'var_1',
      interval: 'month',
      intervalCount: 2,
    });
  });
});

describe('parseCreatePlanFromForm', () => {
  it('parses admin form fields', () => {
    const formData = new FormData();
    formData.set('name', 'Weekly box');
    formData.set('variantId', 'var_1');
    formData.set('interval', 'week');
    formData.set('intervalCount', '2');

    expect(parseCreatePlanFromForm(formData)).toEqual({
      name: 'Weekly box',
      variantId: 'var_1',
      interval: 'week',
      intervalCount: 2,
    });
  });
});

describe('parseUpdatePlanInput', () => {
  it('accepts active toggle updates', () => {
    expect(parseUpdatePlanInput({ active: false })).toEqual({ active: false });
  });

  it('rejects empty updates', () => {
    expect(() => parseUpdatePlanInput({})).toThrow('No plan fields to update');
  });
});

describe('parseSubscriptionListParams', () => {
  it('parses filters and pagination', () => {
    const params = parseSubscriptionListParams(
      new URLSearchParams('page=1&limit=5&customerId=cust_1&status=active')
    );
    expect(params).toEqual({
      page: 1,
      limit: 5,
      customerId: 'cust_1',
      status: 'active',
    });
  });

  it('rejects invalid status filters', () => {
    expect(() => parseSubscriptionListParams({ status: 'bogus' })).toThrow(
      'Invalid subscription status filter'
    );
  });
});

describe('buildSubscriptionWhere', () => {
  it('builds combined filters', () => {
    expect(
      buildSubscriptionWhere({
        customerId: 'cust_1',
        planId: 'plan_1',
        status: 'active',
      })
    ).toEqual({
      customerId: 'cust_1',
      planId: 'plan_1',
      status: 'active',
    });
  });
});

describe('parseCreateSubscriptionInput', () => {
  it('requires customerId and planId', () => {
    expect(() =>
      parseCreateSubscriptionInput({ customerId: 'cust_1' })
    ).toThrow('planId is required');
  });
});

describe('serializePlan', () => {
  it('serializes plan timestamps and variant', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const serialized = serializePlan({
      id: 'plan_1',
      name: 'Monthly',
      variantId: 'var_1',
      interval: 'month',
      intervalCount: 1,
      active: true,
      createdAt,
      updatedAt: createdAt,
      variant: {
        id: 'var_1',
        sku: 'SKU-1',
        productId: 'prod_1',
        product: { title: 'Coffee' },
      },
    });

    expect(serialized).toMatchObject({
      id: 'plan_1',
      name: 'Monthly',
      variant: {
        sku: 'SKU-1',
        productTitle: 'Coffee',
      },
      createdAt: createdAt.toISOString(),
    });
  });
});

describe('serializeSubscription', () => {
  it('serializes subscription relations', () => {
    const serialized = serializeSubscription({
      id: 'sub_1',
      customerId: 'cust_1',
      planId: 'plan_1',
      status: 'active',
      externalSubscriptionId: 'ext_1',
      currentPeriodEnd: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      plan: {
        id: 'plan_1',
        name: 'Monthly',
        interval: 'month',
        intervalCount: 1,
        active: true,
      },
      customer: {
        id: 'cust_1',
        email: 'a@example.com',
        name: 'Alex',
      },
    });

    expect(serialized.plan.name).toBe('Monthly');
    expect(serialized.customer.email).toBe('a@example.com');
  });
});

describe('listSubscriptionPlans', () => {
  it('returns paginated serialized plans', async () => {
    prisma.subscriptionPlan.findMany.mockResolvedValue([
      {
        id: 'plan_1',
        name: 'Monthly',
        variantId: null,
        interval: 'month',
        intervalCount: 1,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        variant: null,
      },
    ]);
    prisma.subscriptionPlan.count.mockResolvedValue(1);

    const result = await listSubscriptionPlans({ activeOnly: false });

    expect(result.plans).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });
});

describe('getSubscriptionPlan', () => {
  it('throws NOT_FOUND when plan is missing', async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue(null);
    await expect(getSubscriptionPlan('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('createSubscriptionPlan', () => {
  it('creates a serialized plan', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({ id: 'var_1' });
    prisma.subscriptionPlan.create.mockResolvedValue({
      id: 'plan_1',
      name: 'Monthly',
      variantId: 'var_1',
      interval: 'month',
      intervalCount: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      variant: null,
    });

    const plan = await createSubscriptionPlan({
      name: 'Monthly',
      variantId: 'var_1',
      interval: 'month',
      intervalCount: 1,
    });

    expect(plan.id).toBe('plan_1');
  });
});

describe('updateSubscriptionPlan', () => {
  it('updates plan fields', async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan_1' });
    prisma.subscriptionPlan.update.mockResolvedValue({
      id: 'plan_1',
      name: 'Monthly',
      variantId: null,
      interval: 'month',
      intervalCount: 1,
      active: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      variant: null,
    });

    const plan = await updateSubscriptionPlan('plan_1', { active: false });
    expect(plan.active).toBe(false);
  });
});

describe('listSubscriptions', () => {
  it('returns paginated serialized subscriptions', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 'sub_1',
        customerId: 'cust_1',
        planId: 'plan_1',
        status: 'active',
        externalSubscriptionId: null,
        currentPeriodEnd: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          id: 'plan_1',
          name: 'Monthly',
          interval: 'month',
          intervalCount: 1,
        },
        customer: {
          id: 'cust_1',
          email: 'a@example.com',
          name: 'Alex',
        },
      },
    ]);
    prisma.subscription.count.mockResolvedValue(1);

    const result = await listSubscriptions({ customerId: 'cust_1' });

    expect(result.subscriptions).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

describe('getSubscription', () => {
  it('throws NOT_FOUND when subscription is missing', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);
    await expect(getSubscription('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('createSubscription', () => {
  it('creates a subscription after validating plan and customer', async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue({ id: 'plan_1' });
    prisma.customer.findUnique.mockResolvedValue({ id: 'cust_1' });
    prisma.subscription.create.mockResolvedValue({
      id: 'sub_1',
      customerId: 'cust_1',
      planId: 'plan_1',
      status: 'active',
      externalSubscriptionId: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      plan: {
        id: 'plan_1',
        name: 'Monthly',
        interval: 'month',
        intervalCount: 1,
        active: true,
      },
      customer: {
        id: 'cust_1',
        email: 'a@example.com',
        name: 'Alex',
      },
    });

    const subscription = await createSubscription({
      customerId: 'cust_1',
      planId: 'plan_1',
    });

    expect(subscription.id).toBe('sub_1');
  });
});

describe('cancelSubscription', () => {
  it('marks subscription as cancelled', async () => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'sub_1' });
    prisma.subscription.update.mockResolvedValue({
      id: 'sub_1',
      customerId: 'cust_1',
      planId: 'plan_1',
      status: 'cancelled',
      externalSubscriptionId: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      plan: {
        id: 'plan_1',
        name: 'Monthly',
        interval: 'month',
        intervalCount: 1,
        active: true,
      },
      customer: {
        id: 'cust_1',
        email: 'a@example.com',
        name: 'Alex',
      },
    });

    const subscription = await cancelSubscription('sub_1');
    expect(subscription.status).toBe('cancelled');
  });
});

describe('constants', () => {
  it('exports interval and status lists', () => {
    expect(SUBSCRIPTION_INTERVALS).toContain('month');
    expect(SUBSCRIPTION_STATUSES).toContain('cancelled');
  });
});
