/**
 * Sales channels and channel product/price assignments.
 */

import { CATALOG, CHANNEL_IDS, PRODUCT_IDS, VARIANT_IDS } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedChannels(prisma) {
  await prisma.salesChannel.upsert({
    where: { handle: 'online' },
    create: {
      id: CHANNEL_IDS.online,
      name: 'Online Store',
      handle: 'online',
      domain: null,
      isDefault: true,
      currency: 'USD',
      locale: 'en',
      active: true,
    },
    update: {
      name: 'Online Store',
      isDefault: true,
      active: true,
    },
  });

  await prisma.salesChannel.upsert({
    where: { handle: 'wholesale' },
    create: {
      id: CHANNEL_IDS.wholesale,
      name: 'Wholesale',
      handle: 'wholesale',
      isDefault: false,
      currency: 'USD',
      locale: 'en',
      active: true,
    },
    update: {
      name: 'Wholesale',
      active: true,
    },
  });

  const online = await prisma.salesChannel.findUniqueOrThrow({
    where: { handle: 'online' },
  });
  const wholesale = await prisma.salesChannel.findUniqueOrThrow({
    where: { handle: 'wholesale' },
  });

  for (const item of CATALOG) {
    await prisma.channelProduct.upsert({
      where: {
        channelId_productId: {
          channelId: online.id,
          productId: item.productId,
        },
      },
      create: {
        id: `seed-cp-online-${item.productId}`,
        channelId: online.id,
        productId: item.productId,
        published: true,
      },
      update: { published: true },
    });
  }

  // Wholesale publishes a subset with price overrides
  const wholesaleProducts = [
    PRODUCT_IDS.bambooSpeaker,
    PRODUCT_IDS.organicTee,
    PRODUCT_IDS.stonewareMugs,
    PRODUCT_IDS.yogaMat,
  ];
  for (const productId of wholesaleProducts) {
    await prisma.channelProduct.upsert({
      where: {
        channelId_productId: {
          channelId: wholesale.id,
          productId,
        },
      },
      create: {
        id: `seed-cp-ws-${productId}`,
        channelId: wholesale.id,
        productId,
        published: true,
      },
      update: { published: true },
    });
  }

  await prisma.channelPriceOverride.upsert({
    where: {
      channelId_variantId_currency: {
        channelId: wholesale.id,
        variantId: VARIANT_IDS.bambooSpeaker,
        currency: 'USD',
      },
    },
    create: {
      id: 'seed-cpo-bamboo',
      channelId: wholesale.id,
      variantId: VARIANT_IDS.bambooSpeaker,
      currency: 'USD',
      priceCents: 5900,
    },
    update: { priceCents: 5900 },
  });

  console.log('Seeded sales channels and channel products.');
}
