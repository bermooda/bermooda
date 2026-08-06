/**
 * Subscription plans/subscriptions and POS sessions/orders.
 */

import { listSeedCustomers } from './customers.js';
import { daysAgo } from './helpers.js';
import { VARIANT_IDS } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {string} adminUserId
 */
export async function seedSubscriptionsPos(prisma, adminUserId) {
  const customers = await listSeedCustomers(prisma);

  const monthly = await prisma.subscriptionPlan.upsert({
    where: { id: 'seed-plan-tea-monthly' },
    create: {
      id: 'seed-plan-tea-monthly',
      name: 'Herbal tea — monthly',
      variantId: VARIANT_IDS.herbalTea,
      interval: 'month',
      intervalCount: 1,
      active: true,
    },
    update: {
      name: 'Herbal tea — monthly',
      active: true,
      variantId: VARIANT_IDS.herbalTea,
    },
  });

  const annual = await prisma.subscriptionPlan.upsert({
    where: { id: 'seed-plan-speaker-annual' },
    create: {
      id: 'seed-plan-speaker-annual',
      name: 'Speaker care kit — annual',
      variantId: VARIANT_IDS.bambooSpeaker,
      interval: 'year',
      intervalCount: 1,
      active: true,
    },
    update: {
      name: 'Speaker care kit — annual',
      active: true,
    },
  });

  if (customers[0]) {
    await prisma.subscription.upsert({
      where: { id: 'seed-sub-01' },
      create: {
        id: 'seed-sub-01',
        customerId: customers[0].id,
        planId: monthly.id,
        status: 'active',
        currentPeriodEnd: daysAgo(-20),
      },
      update: {
        status: 'active',
        planId: monthly.id,
        currentPeriodEnd: daysAgo(-20),
      },
    });
  }
  if (customers[1]) {
    await prisma.subscription.upsert({
      where: { id: 'seed-sub-02' },
      create: {
        id: 'seed-sub-02',
        customerId: customers[1].id,
        planId: annual.id,
        status: 'paused',
        currentPeriodEnd: daysAgo(-60),
      },
      update: {
        status: 'paused',
        planId: annual.id,
      },
    });
  }
  if (customers[2]) {
    await prisma.subscription.upsert({
      where: { id: 'seed-sub-03' },
      create: {
        id: 'seed-sub-03',
        customerId: customers[2].id,
        planId: monthly.id,
        status: 'cancelled',
        currentPeriodEnd: daysAgo(5),
      },
      update: { status: 'cancelled' },
    });
  }

  // POS
  const location = await prisma.location.findUnique({
    where: { code: 'storefront' },
  });

  if (!adminUserId) {
    console.warn('No admin user id; skipping POS seed.');
    console.log('Seeded subscription plans and subscriptions.');
    return;
  }

  const session = await prisma.posSession.upsert({
    where: { id: 'seed-pos-session-01' },
    create: {
      id: 'seed-pos-session-01',
      staffId: adminUserId,
      locationId: location?.id ?? null,
      status: 'open',
      openedAt: daysAgo(0),
    },
    update: {
      status: 'open',
      locationId: location?.id ?? null,
    },
  });

  // Link a completed POS order to an existing demo order when present
  const linkedOrder = await prisma.order.findUnique({
    where: { orderNumber: 'DEMO-1013' },
  });

  await prisma.posOrder.upsert({
    where: { id: 'seed-pos-order-01' },
    create: {
      id: 'seed-pos-order-01',
      posSessionId: session.id,
      orderId: linkedOrder?.id ?? null,
      status: linkedOrder ? 'completed' : 'draft',
      totalCents: linkedOrder?.totalCents ?? 0,
      currency: 'USD',
    },
    update: {
      orderId: linkedOrder?.id ?? null,
      status: linkedOrder ? 'completed' : 'draft',
      totalCents: linkedOrder?.totalCents ?? 0,
    },
  });

  await prisma.posOrder.upsert({
    where: { id: 'seed-pos-order-02' },
    create: {
      id: 'seed-pos-order-02',
      posSessionId: session.id,
      status: 'draft',
      totalCents: 4200,
      currency: 'USD',
    },
    update: {
      status: 'draft',
      totalCents: 4200,
    },
  });

  console.log('Seeded subscriptions and POS session/orders.');
}
