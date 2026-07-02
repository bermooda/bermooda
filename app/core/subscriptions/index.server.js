// app/core/subscriptions/index.server.js
// Recurring billing foundation (Stripe subscription mode).

import prisma from '#/libs/prisma.server';

export async function listSubscriptionPlans({ activeOnly = true } = {}) {
  return prisma.subscriptionPlan.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { variant: true },
  });
}

export async function createSubscriptionPlan({
  name,
  variantId,
  interval = 'month',
  intervalCount = 1,
}) {
  return prisma.subscriptionPlan.create({
    data: { name, variantId, interval, intervalCount, active: true },
  });
}

export async function createSubscription({
  customerId,
  planId,
  externalSubscriptionId,
  currentPeriodEnd,
}) {
  return prisma.subscription.create({
    data: {
      customerId,
      planId,
      externalSubscriptionId,
      currentPeriodEnd,
      status: 'active',
    },
  });
}

export async function listCustomerSubscriptions(customerId) {
  return prisma.subscription.findMany({
    where: { customerId },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function cancelSubscription(id) {
  return prisma.subscription.update({
    where: { id },
    data: { status: 'cancelled' },
  });
}
