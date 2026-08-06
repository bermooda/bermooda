/**
 * Collections, tags, customer groups, price lists, gift cards,
 * wishlists, and back-in-stock subscriptions.
 */

import { listSeedCustomers } from './customers.js';
import { daysAgo, upsertSlug, upsertTranslation } from './helpers.js';
import { CATALOG, GROUP_IDS, PRODUCT_IDS, VARIANT_IDS } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedCommerceExtras(prisma) {
  const customers = await listSeedCustomers(prisma);

  // Collections
  const featured = await prisma.collection.upsert({
    where: { handle: 'featured' },
    create: {
      id: 'seed-col-featured',
      handle: 'featured',
      collectionType: 'manual',
      position: 0,
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date(), position: 0 },
  });
  await upsertSlug(prisma, 'collection', featured.id, 'featured');
  await upsertTranslation(
    prisma,
    'collection',
    featured.id,
    'title',
    'Featured'
  );
  await upsertTranslation(
    prisma,
    'collection',
    featured.id,
    'description',
    'Hand-picked favorites from the catalog.'
  );

  const outdoor = await prisma.collection.upsert({
    where: { handle: 'outdoor-essentials' },
    create: {
      id: 'seed-col-outdoor',
      handle: 'outdoor-essentials',
      collectionType: 'manual',
      position: 1,
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });
  await upsertSlug(prisma, 'collection', outdoor.id, 'outdoor-essentials');
  await upsertTranslation(
    prisma,
    'collection',
    outdoor.id,
    'title',
    'Outdoor essentials'
  );

  const featuredProducts = [
    PRODUCT_IDS.bambooSpeaker,
    PRODUCT_IDS.yogaMat,
    PRODUCT_IDS.ledLamp,
    PRODUCT_IDS.herbalTea,
  ];
  for (let i = 0; i < featuredProducts.length; i++) {
    await prisma.collectionProduct.upsert({
      where: {
        collectionId_productId: {
          collectionId: featured.id,
          productId: featuredProducts[i],
        },
      },
      create: {
        collectionId: featured.id,
        productId: featuredProducts[i],
        position: i,
      },
      update: { position: i },
    });
  }

  for (const [i, productId] of [
    PRODUCT_IDS.hydrationPack,
    PRODUCT_IDS.ceramicPots,
    PRODUCT_IDS.yogaMat,
  ].entries()) {
    await prisma.collectionProduct.upsert({
      where: {
        collectionId_productId: {
          collectionId: outdoor.id,
          productId,
        },
      },
      create: {
        collectionId: outdoor.id,
        productId,
        position: i,
      },
      update: { position: i },
    });
  }

  // Tags
  const tagNames = ['eco-friendly', 'bestseller', 'new', 'gift-ready'];
  const tags = [];
  for (const name of tagNames) {
    const tag = await prisma.productTag.upsert({
      where: { name },
      create: { id: `seed-tag-${name}`, name },
      update: {},
    });
    tags.push(tag);
  }
  const tagAssignments = [
    [PRODUCT_IDS.bambooSpeaker, 'eco-friendly'],
    [PRODUCT_IDS.bambooSpeaker, 'bestseller'],
    [PRODUCT_IDS.organicTee, 'eco-friendly'],
    [PRODUCT_IDS.organicTee, 'new'],
    [PRODUCT_IDS.yogaMat, 'bestseller'],
    [PRODUCT_IDS.herbalTea, 'gift-ready'],
    [PRODUCT_IDS.dogLeash, 'gift-ready'],
  ];
  for (const [productId, tagName] of tagAssignments) {
    const tag = tags.find((t) => t.name === tagName);
    if (!tag) continue;
    await prisma.productTagAssignment.upsert({
      where: {
        productId_tagId: { productId, tagId: tag.id },
      },
      create: { productId, tagId: tag.id },
      update: {},
    });
  }

  // Customer groups
  await prisma.customerGroup.upsert({
    where: { handle: 'vip' },
    create: {
      id: GROUP_IDS.vip,
      name: 'VIP',
      handle: 'vip',
    },
    update: { name: 'VIP' },
  });
  await prisma.customerGroup.upsert({
    where: { handle: 'wholesale' },
    create: {
      id: GROUP_IDS.wholesale,
      name: 'Wholesale',
      handle: 'wholesale',
    },
    update: { name: 'Wholesale' },
  });

  const vip = await prisma.customerGroup.findUniqueOrThrow({
    where: { handle: 'vip' },
  });
  const wholesale = await prisma.customerGroup.findUniqueOrThrow({
    where: { handle: 'wholesale' },
  });

  for (const customer of customers.slice(0, 4)) {
    await prisma.customerGroupMember.upsert({
      where: {
        customerGroupId_customerId: {
          customerGroupId: vip.id,
          customerId: customer.id,
        },
      },
      create: {
        customerGroupId: vip.id,
        customerId: customer.id,
      },
      update: {},
    });
  }
  for (const customer of customers.slice(10, 13)) {
    await prisma.customerGroupMember.upsert({
      where: {
        customerGroupId_customerId: {
          customerGroupId: wholesale.id,
          customerId: customer.id,
        },
      },
      create: {
        customerGroupId: wholesale.id,
        customerId: customer.id,
      },
      update: {},
    });
  }

  // Price lists
  const vipList = await prisma.priceList.upsert({
    where: { id: 'seed-pl-vip' },
    create: {
      id: 'seed-pl-vip',
      name: 'VIP pricing',
      customerGroupId: vip.id,
      currency: 'USD',
      priority: 10,
      active: true,
    },
    update: {
      name: 'VIP pricing',
      customerGroupId: vip.id,
      active: true,
    },
  });

  for (const item of CATALOG.slice(0, 5)) {
    await prisma.priceListEntry.upsert({
      where: {
        priceListId_variantId_minQuantity: {
          priceListId: vipList.id,
          variantId: item.variantId,
          minQuantity: 1,
        },
      },
      create: {
        priceListId: vipList.id,
        variantId: item.variantId,
        priceCents: Math.round(item.priceCents * 0.9),
        minQuantity: 1,
      },
      update: {
        priceCents: Math.round(item.priceCents * 0.9),
      },
    });
  }

  // Gift cards
  await prisma.giftCard.upsert({
    where: { code: 'WELCOME25' },
    create: {
      id: 'seed-gc-welcome25',
      code: 'WELCOME25',
      initialBalanceCents: 2500,
      balanceCents: 2500,
      currency: 'USD',
      status: 'active',
    },
    update: {},
  });

  if (customers[0]) {
    await prisma.giftCard.upsert({
      where: { code: 'THANKS50' },
      create: {
        id: 'seed-gc-thanks50',
        code: 'THANKS50',
        initialBalanceCents: 5000,
        balanceCents: 3500,
        currency: 'USD',
        customerId: customers[0].id,
        status: 'active',
        expiresAt: daysAgo(-90),
      },
      update: {
        balanceCents: 3500,
        customerId: customers[0].id,
        status: 'active',
      },
    });
  }

  await prisma.giftCard.upsert({
    where: { code: 'USEDUP10' },
    create: {
      id: 'seed-gc-usedup',
      code: 'USEDUP10',
      initialBalanceCents: 1000,
      balanceCents: 0,
      currency: 'USD',
      status: 'redeemed',
    },
    update: { balanceCents: 0, status: 'redeemed' },
  });

  // Wishlists
  for (let i = 0; i < Math.min(5, customers.length); i++) {
    const customer = customers[i];
    const wishlistId = `seed-wishlist-${String(i + 1).padStart(2, '0')}`;
    await prisma.wishlist.upsert({
      where: { id: wishlistId },
      create: {
        id: wishlistId,
        customerId: customer.id,
        name: 'Favorites',
        isDefault: true,
      },
      update: { name: 'Favorites', isDefault: true },
    });
    const variants = [
      VARIANT_IDS.bambooSpeaker,
      VARIANT_IDS.yogaMat,
      VARIANT_IDS.ledLamp,
    ];
    for (const variantId of variants.slice(0, 2 + (i % 2))) {
      await prisma.wishlistItem.upsert({
        where: {
          wishlistId_variantId: { wishlistId, variantId },
        },
        create: { wishlistId, variantId },
        update: {},
      });
    }
  }

  // Back-in-stock
  const bisEntries = [
    {
      id: 'seed-bis-01',
      variantId: VARIANT_IDS.hydrationPack,
      email: 'waitlist1@example.com',
      customerId: customers[1]?.id ?? null,
    },
    {
      id: 'seed-bis-02',
      variantId: VARIANT_IDS.ledLamp,
      email: 'waitlist2@example.com',
      customerId: customers[2]?.id ?? null,
    },
    {
      id: 'seed-bis-03',
      variantId: VARIANT_IDS.bambooSpeaker,
      email: 'notified@example.com',
      customerId: null,
      notifiedAt: daysAgo(2),
    },
  ];
  for (const entry of bisEntries) {
    await prisma.backInStockSubscription.upsert({
      where: {
        variantId_email: {
          variantId: entry.variantId,
          email: entry.email,
        },
      },
      create: {
        id: entry.id,
        variantId: entry.variantId,
        email: entry.email,
        customerId: entry.customerId,
        notifiedAt: entry.notifiedAt ?? null,
      },
      update: {
        customerId: entry.customerId,
        notifiedAt: entry.notifiedAt ?? null,
      },
    });
  }

  console.log(
    'Seeded collections, tags, groups, price lists, gift cards, wishlists, and back-in-stock.'
  );
}
