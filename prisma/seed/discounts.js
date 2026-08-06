/**
 * Demo discount codes and automatic promotions.
 */

import { daysAgo } from './helpers.js';
import { DISCOUNT_IDS, GROUP_IDS } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedDiscounts(prisma) {
  // Ensure VIP group exists before discount FK (full memberships seeded later).
  await prisma.customerGroup.upsert({
    where: { handle: 'vip' },
    create: { id: GROUP_IDS.vip, name: 'VIP', handle: 'vip' },
    update: { name: 'VIP' },
  });
  const vip = await prisma.customerGroup.findUniqueOrThrow({
    where: { handle: 'vip' },
  });

  const discounts = [
    {
      id: DISCOUNT_IDS.welcome10,
      code: 'WELCOME10',
      title: 'Welcome 10% off',
      type: 'percent',
      value: 10,
      appliesTo: 'order',
      maxUsesCount: 1000,
      usedCount: 12,
      automatic: false,
      active: true,
    },
    {
      id: DISCOUNT_IDS.freship,
      code: 'FREESHIP',
      title: 'Free shipping over $50',
      type: 'fixed',
      value: 799,
      currency: 'USD',
      appliesTo: 'shipping',
      minSubtotalCents: 5000,
      automatic: true,
      active: true,
    },
    {
      id: DISCOUNT_IDS.vip15,
      code: 'VIP15',
      title: 'VIP members 15% off',
      type: 'percent',
      value: 15,
      appliesTo: 'order',
      customerGroupId: vip.id,
      automatic: false,
      active: true,
    },
    {
      id: DISCOUNT_IDS.summer25,
      code: 'SUMMER25',
      title: '$25 summer gift',
      type: 'fixed',
      value: 2500,
      currency: 'USD',
      appliesTo: 'order',
      minSubtotalCents: 10000,
      stackable: true,
      active: true,
      startsAt: daysAgo(30),
    },
    {
      id: DISCOUNT_IDS.expired,
      code: 'EXPIRED20',
      title: 'Expired promo (inactive)',
      type: 'percent',
      value: 20,
      appliesTo: 'order',
      active: false,
      expiresAt: daysAgo(14),
    },
  ];

  for (const d of discounts) {
    const { id, ...data } = d;
    await prisma.discount.upsert({
      where: { code: d.code },
      create: { id, ...data },
      update: {
        title: data.title,
        type: data.type,
        value: data.value,
        active: data.active,
        automatic: data.automatic ?? false,
        appliesTo: data.appliesTo,
        currency: data.currency ?? null,
        minSubtotalCents: data.minSubtotalCents ?? null,
        maxUsesCount: data.maxUsesCount ?? null,
        usedCount: data.usedCount ?? 0,
        customerGroupId: data.customerGroupId ?? null,
        stackable: data.stackable ?? false,
        startsAt: data.startsAt ?? null,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  console.log(`Seeded ${discounts.length} discounts.`);
}
