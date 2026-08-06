/**
 * Demo catalog: categories + products.
 */

import { PRICE_CURRENCIES, upsertSlug, upsertTranslation } from './helpers.js';
import { CATEGORY_IDS, PRODUCT_IDS, VARIANT_IDS } from './ids.js';

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {object} category
 */
async function upsertCategory(prisma, category) {
  const { id, slug, title, description, position, parentId } = category;
  await prisma.category.upsert({
    where: { id },
    create: {
      id,
      position,
      ...(parentId ? { parentId } : {}),
    },
    update: {
      position,
      ...(parentId !== undefined ? { parentId } : {}),
    },
  });
  await upsertSlug(prisma, 'category', id, slug);
  await upsertTranslation(prisma, 'category', id, 'title', title);
  await upsertTranslation(prisma, 'category', id, 'description', description);
}

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {object} product
 */
async function upsertProduct(prisma, product) {
  const {
    id,
    slug,
    title,
    description,
    position,
    variantId,
    sku,
    inventoryCount,
    prices,
    productType,
  } = product;
  await prisma.product.upsert({
    where: { id },
    create: {
      id,
      productType: productType ?? 'physical',
      publishedAt: new Date(),
      position,
      variants: {
        create: {
          id: variantId,
          sku,
          inventoryCount,
          inventoryTracked: true,
          position: 1,
          prices: {
            createMany: {
              data: prices ?? PRICE_CURRENCIES,
            },
          },
        },
      },
    },
    update: {
      publishedAt: new Date(),
      position,
      ...(productType ? { productType } : {}),
    },
  });
  await upsertSlug(prisma, 'product', id, slug);
  await upsertTranslation(prisma, 'product', id, 'title', title);
  await upsertTranslation(prisma, 'product', id, 'description', description);
}

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {string} productId
 * @param {string} categoryId
 * @param {number} [position]
 */
async function linkProductToCategory(
  prisma,
  productId,
  categoryId,
  position = 0
) {
  await prisma.productCategory.upsert({
    where: {
      productId_categoryId: { productId, categoryId },
    },
    create: { productId, categoryId, position },
    update: { position },
  });
}

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 */
export async function seedCatalog(prisma) {
  const categories = [
    {
      id: CATEGORY_IDS.audio,
      slug: 'audio-electronics',
      title: 'Audio & electronics',
      description: 'Speakers, headphones, and small gadgets for work and play.',
      position: 1,
    },
    {
      id: CATEGORY_IDS.apparel,
      slug: 'apparel',
      title: 'Apparel',
      description: 'Comfortable everyday clothing and layering pieces.',
      position: 2,
    },
    {
      id: CATEGORY_IDS.home,
      slug: 'home-decor',
      title: 'Home décor',
      description: 'Lighting, accents, and pieces that personalize your space.',
      position: 3,
    },
    {
      id: CATEGORY_IDS.kitchen,
      slug: 'kitchenware',
      title: 'Kitchenware',
      description: 'Mugs, prep tools, and staples for cooking at home.',
      position: 4,
    },
    {
      id: CATEGORY_IDS.outdoor,
      slug: 'outdoor-living',
      title: 'Outdoor living',
      description: 'Gear for patios, gardens, and weekend adventures.',
      position: 5,
    },
    {
      id: CATEGORY_IDS.wellness,
      slug: 'wellness',
      title: 'Wellness',
      description: 'Relaxation, recovery, and mindful routines.',
      position: 6,
    },
    {
      id: CATEGORY_IDS.sports,
      slug: 'sports',
      title: 'Sports gear',
      description: 'Training essentials and active lifestyle accessories.',
      position: 7,
    },
    {
      id: CATEGORY_IDS.pets,
      slug: 'pets',
      title: 'Pet care',
      description: 'Leashes, bowls, and everyday items for companion animals.',
      position: 8,
    },
    {
      id: CATEGORY_IDS.gifts,
      slug: 'gifts',
      title: 'Gifts & specialty',
      description:
        'Curated picks for holidays, thank-yous, and treat-yourself moments.',
      position: 9,
    },
  ];

  for (const c of categories) {
    await upsertCategory(prisma, c);
  }

  const products = [
    {
      id: PRODUCT_IDS.bambooSpeaker,
      variantId: VARIANT_IDS.bambooSpeaker,
      slug: 'bamboo-bluetooth-speaker',
      sku: 'BERM-AUDIO-001',
      title: 'Bamboo Bluetooth speaker',
      description:
        'Compact speaker with warm tone and twelve hours of playback; great for desks and picnics.',
      position: 1,
      inventoryCount: 80,
      prices: [
        { currency: 'USD', priceCents: 7900 },
        { currency: 'EUR', priceCents: 7200 },
        { currency: 'AUD', priceCents: 11900 },
      ],
      categories: [
        [CATEGORY_IDS.audio, 0],
        [CATEGORY_IDS.gifts, 1],
      ],
    },
    {
      id: PRODUCT_IDS.organicTee,
      variantId: VARIANT_IDS.organicTee,
      slug: 'organic-cotton-pocket-tee',
      sku: 'BERM-APP-002',
      title: 'Organic cotton pocket tee',
      description:
        'Midweight jersey in undyed natural cotton with a chest pocket and relaxed fit.',
      position: 2,
      inventoryCount: 240,
      prices: [
        { currency: 'USD', priceCents: 4200 },
        { currency: 'EUR', priceCents: 3900 },
        { currency: 'AUD', priceCents: 6200 },
      ],
      categories: [[CATEGORY_IDS.apparel, 0]],
    },
    {
      id: PRODUCT_IDS.stonewareMugs,
      variantId: VARIANT_IDS.stonewareMugs,
      slug: 'stoneware-mug-set',
      sku: 'BERM-KIT-003',
      title: 'Stoneware mug set (set of 4)',
      description:
        'Microwave-safe mugs with a soft matte glaze; stack neatly in the cupboard.',
      position: 3,
      inventoryCount: 95,
      prices: [
        { currency: 'USD', priceCents: 5600 },
        { currency: 'EUR', priceCents: 5200 },
        { currency: 'AUD', priceCents: 8200 },
      ],
      categories: [
        [CATEGORY_IDS.kitchen, 0],
        [CATEGORY_IDS.home, 1],
      ],
    },
    {
      id: PRODUCT_IDS.ledLamp,
      variantId: VARIANT_IDS.ledLamp,
      slug: 'led-desk-lamp-dimmable',
      sku: 'BERM-HOM-004',
      title: 'LED desk lamp (dimmable)',
      description:
        'Adjustable arm, three color temperatures, and memory for your last brightness setting.',
      position: 4,
      inventoryCount: 65,
      prices: [
        { currency: 'USD', priceCents: 6800 },
        { currency: 'EUR', priceCents: 6300 },
        { currency: 'AUD', priceCents: 9900 },
      ],
      categories: [
        [CATEGORY_IDS.home, 0],
        [CATEGORY_IDS.audio, 1],
      ],
    },
    {
      id: PRODUCT_IDS.yogaMat,
      variantId: VARIANT_IDS.yogaMat,
      slug: 'cork-yoga-mat',
      sku: 'BERM-SPT-005',
      title: 'Cork-top yoga mat',
      description:
        'Non-slip natural cork surface with a dense rubber base; includes carry strap.',
      position: 5,
      inventoryCount: 110,
      prices: [
        { currency: 'USD', priceCents: 8900 },
        { currency: 'EUR', priceCents: 8200 },
        { currency: 'AUD', priceCents: 12900 },
      ],
      categories: [
        [CATEGORY_IDS.wellness, 0],
        [CATEGORY_IDS.sports, 1],
      ],
    },
    {
      id: PRODUCT_IDS.hydrationPack,
      variantId: VARIANT_IDS.hydrationPack,
      slug: 'trail-hydration-pack-2l',
      sku: 'BERM-OUT-006',
      title: 'Trail hydration pack (2 L)',
      description:
        'Lightweight vest fit with two soft flasks and zip pockets for keys and snacks.',
      position: 6,
      inventoryCount: 55,
      prices: [
        { currency: 'USD', priceCents: 11200 },
        { currency: 'EUR', priceCents: 10400 },
        { currency: 'AUD', priceCents: 16400 },
      ],
      categories: [
        [CATEGORY_IDS.outdoor, 0],
        [CATEGORY_IDS.sports, 1],
      ],
    },
    {
      id: PRODUCT_IDS.herbalTea,
      variantId: VARIANT_IDS.herbalTea,
      slug: 'herbal-tea-collection',
      sku: 'BERM-WEL-007',
      title: 'Herbal tea collection',
      description:
        'Nine loose-leaf blends in tins: chamomile, mint, rooibos, and more.',
      position: 7,
      inventoryCount: 130,
      prices: [
        { currency: 'USD', priceCents: 3400 },
        { currency: 'EUR', priceCents: 3100 },
        { currency: 'AUD', priceCents: 4900 },
      ],
      categories: [
        [CATEGORY_IDS.wellness, 0],
        [CATEGORY_IDS.gifts, 1],
      ],
    },
    {
      id: PRODUCT_IDS.dogLeash,
      variantId: VARIANT_IDS.dogLeash,
      slug: 'woven-dog-leash-collar-set',
      sku: 'BERM-PET-008',
      title: 'Woven leash & collar set',
      description:
        'Weather-resistant nylon weave with brass hardware; adjusts for medium breeds.',
      position: 8,
      inventoryCount: 175,
      prices: [
        { currency: 'USD', priceCents: 4800 },
        { currency: 'EUR', priceCents: 4400 },
        { currency: 'AUD', priceCents: 7000 },
      ],
      categories: [[CATEGORY_IDS.pets, 0]],
    },
    {
      id: PRODUCT_IDS.ceramicPots,
      variantId: VARIANT_IDS.ceramicPots,
      slug: 'ceramic-plant-pot-trio',
      sku: 'BERM-HOM-009',
      title: 'Ceramic plant pot trio',
      description:
        'Three graduated planters with drainage dishes; glaze varies slightly by batch.',
      position: 9,
      inventoryCount: 70,
      prices: [
        { currency: 'USD', priceCents: 5200 },
        { currency: 'EUR', priceCents: 4800 },
        { currency: 'AUD', priceCents: 7800 },
      ],
      categories: [
        [CATEGORY_IDS.home, 0],
        [CATEGORY_IDS.outdoor, 1],
      ],
    },
  ];

  const legacyDemo = {
    id: PRODUCT_IDS.legacyDemo,
    variantId: VARIANT_IDS.legacyDemo,
    slug: 'demo-product',
    sku: 'DEMO-001',
    title: 'Demo product',
    description:
      'Starter catalog item retained for backwards-compatible demo links.',
    position: 10,
    inventoryCount: 100,
    categories: [[CATEGORY_IDS.gifts, 2]],
  };

  await upsertProduct(prisma, legacyDemo);
  for (const [categoryId, pos] of legacyDemo.categories) {
    await linkProductToCategory(prisma, legacyDemo.id, categoryId, pos);
  }

  for (const p of products) {
    const { categories: catTuples, ...rest } = p;
    await upsertProduct(prisma, rest);
    for (const [categoryId, pos] of catTuples) {
      await linkProductToCategory(prisma, p.id, categoryId, pos);
    }
  }

  // Sample product attributes for faceted search demos
  const attr = await prisma.productAttribute.upsert({
    where: { id: 'seed-attr-material' },
    create: {
      id: 'seed-attr-material',
      productId: PRODUCT_IDS.yogaMat,
      name: 'Material',
      position: 0,
    },
    update: { name: 'Material', position: 0 },
  });
  await prisma.productAttributeValue.upsert({
    where: { id: 'seed-attr-material-cork' },
    create: {
      id: 'seed-attr-material-cork',
      attributeId: attr.id,
      value: 'Cork',
      position: 0,
    },
    update: { value: 'Cork' },
  });

  // Related products
  await prisma.productRelation.upsert({
    where: {
      productId_relatedId_relationType: {
        productId: PRODUCT_IDS.yogaMat,
        relatedId: PRODUCT_IDS.herbalTea,
        relationType: 'related',
      },
    },
    create: {
      id: 'seed-rel-yoga-tea',
      productId: PRODUCT_IDS.yogaMat,
      relatedId: PRODUCT_IDS.herbalTea,
      relationType: 'related',
      position: 0,
    },
    update: { position: 0 },
  });

  console.log(
    `Seeded ${categories.length} categories and ${products.length + 1} products.`
  );
}
