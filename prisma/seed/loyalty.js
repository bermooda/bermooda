/**
 * Loyalty points, referrals, and store credit.
 */

import { listSeedCustomers } from './customers.js';
import { daysAgo } from './helpers.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedLoyalty(prisma) {
  const customers = await listSeedCustomers(prisma);
  if (customers.length < 2) {
    console.warn('Need at least 2 customers for loyalty/referrals; skipping.');
    return;
  }

  // Loyalty ledger for first few customers
  const loyaltySpecs = [
    {
      customer: customers[0],
      points: 500,
      balance: 500,
      reason: 'Welcome bonus',
    },
    {
      customer: customers[0],
      points: 120,
      balance: 620,
      reason: 'Order DEMO-1006',
      referenceType: 'order',
      referenceId: 'seed-order-06',
    },
    {
      customer: customers[1],
      points: 250,
      balance: 250,
      reason: 'Welcome bonus',
    },
    {
      customer: customers[2],
      points: 80,
      balance: 80,
      reason: 'Review reward',
    },
    {
      customer: customers[3],
      points: -50,
      balance: 150,
      reason: 'Redeemed at checkout',
    },
    {
      customer: customers[3],
      points: 200,
      balance: 200,
      reason: 'Welcome bonus',
      // note: order matters for display; balances are illustrative
    },
  ];

  for (let i = 0; i < loyaltySpecs.length; i++) {
    const spec = loyaltySpecs[i];
    const id = `seed-loyalty-${String(i + 1).padStart(2, '0')}`;
    await prisma.loyaltyTransaction.upsert({
      where: { id },
      create: {
        id,
        customerId: spec.customer.id,
        points: spec.points,
        balanceAfter: spec.balance,
        reason: spec.reason,
        referenceType: spec.referenceType ?? null,
        referenceId: spec.referenceId ?? null,
        createdAt: daysAgo(30 - i),
      },
      update: {
        points: spec.points,
        balanceAfter: spec.balance,
        reason: spec.reason,
      },
    });
  }

  // Referral codes
  const referrer = customers[0];
  const referred = customers[5] ?? customers[1];

  const referralCode = await prisma.referralCode.upsert({
    where: { customerId: referrer.id },
    create: {
      id: 'seed-referral-code-01',
      customerId: referrer.id,
      code: 'ALEXFRIEND',
    },
    update: { code: 'ALEXFRIEND' },
  });

  await prisma.referral.upsert({
    where: { referredCustomerId: referred.id },
    create: {
      id: 'seed-referral-01',
      referralCodeId: referralCode.id,
      referredCustomerId: referred.id,
      firstOrderId: 'seed-order-03',
      rewardGrantedAt: daysAgo(10),
    },
    update: {
      referralCodeId: referralCode.id,
      firstOrderId: 'seed-order-03',
      rewardGrantedAt: daysAgo(10),
    },
  });

  // Store credit
  const creditEntries = [
    {
      id: 'seed-credit-01',
      customer: customers[0],
      amountCents: 2500,
      balanceAfterCents: 2500,
      reason: 'Return credit',
      referenceType: 'return',
      referenceId: 'seed-return-08',
    },
    {
      id: 'seed-credit-02',
      customer: customers[0],
      amountCents: -1000,
      balanceAfterCents: 1500,
      reason: 'Applied to order',
      referenceType: 'order',
      referenceId: 'seed-order-12',
    },
    {
      id: 'seed-credit-03',
      customer: customers[2],
      amountCents: 1500,
      balanceAfterCents: 1500,
      reason: 'Goodwill credit',
    },
  ];

  for (const entry of creditEntries) {
    await prisma.storeCreditLedger.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        customerId: entry.customer.id,
        amountCents: entry.amountCents,
        balanceAfterCents: entry.balanceAfterCents,
        reason: entry.reason,
        referenceType: entry.referenceType ?? null,
        referenceId: entry.referenceId ?? null,
        createdAt: daysAgo(12),
      },
      update: {
        amountCents: entry.amountCents,
        balanceAfterCents: entry.balanceAfterCents,
        reason: entry.reason,
      },
    });
  }

  console.log('Seeded loyalty transactions, referrals, and store credit.');
}
