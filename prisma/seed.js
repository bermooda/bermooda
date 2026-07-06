import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

import {
  DEFAULT_ENABLED_PLUGINS,
  DEFAULT_PLUGIN_ORDER,
  SETTING_DEFAULTS,
} from '../app/core/settings/defaults.js';
import { PrismaClient } from './generated/client.ts';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PRICE_CURRENCIES = [
  { currency: 'USD', priceCents: 2999 },
  { currency: 'EUR', priceCents: 2799 },
  { currency: 'AUD', priceCents: 4499 },
];

async function upsertSetting(key, value) {
  const serialized = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: serialized },
    update: { value: serialized },
  });
}

async function upsertSlug(entityType, entityId, slug, locale = 'en') {
  await prisma.slug.upsert({
    where: {
      entityType_entityId_locale: {
        entityType,
        entityId,
        locale,
      },
    },
    create: {
      entityType,
      entityId,
      locale,
      slug,
      canonical: true,
    },
    update: { slug },
  });
}

async function upsertTranslation(
  entityType,
  entityId,
  field,
  value,
  locale = 'en'
) {
  await prisma.translation.upsert({
    where: {
      entityType_entityId_locale_field: {
        entityType,
        entityId,
        locale,
        field,
      },
    },
    create: {
      entityType,
      entityId,
      locale,
      field,
      value,
    },
    update: { value },
  });
}

async function upsertCategory(category) {
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
  await upsertSlug('category', id, slug);
  await upsertTranslation('category', id, 'title', title);
  await upsertTranslation('category', id, 'description', description);
}

async function upsertProduct(product) {
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
  } = product;
  await prisma.product.upsert({
    where: { id },
    create: {
      id,
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
    },
  });
  await upsertSlug('product', id, slug);
  await upsertTranslation('product', id, 'title', title);
  await upsertTranslation('product', id, 'description', description);
}

async function linkProductToCategory(productId, categoryId, position = 0) {
  await prisma.productCategory.upsert({
    where: {
      productId_categoryId: { productId, categoryId },
    },
    create: { productId, categoryId, position },
    update: { position },
  });
}

async function main() {
  console.log('Seeding database…');

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@bermooda.dev';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123!';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Admin',
      emailVerified: true,
      role: 'admin',
      accounts: {
        create: {
          accountId: adminEmail,
          providerId: 'credential',
          password: passwordHash,
        },
      },
    },
    update: { role: 'admin', emailVerified: true },
  });

  console.log(`Admin user: ${admin.email} (id: ${admin.id})`);

  await upsertSetting('defaultCurrency', SETTING_DEFAULTS.defaultCurrency);
  await upsertSetting('currencies', SETTING_DEFAULTS.currencies);
  await upsertSetting('defaultLocale', SETTING_DEFAULTS.defaultLocale);
  await upsertSetting('locales', SETTING_DEFAULTS.locales);
  await upsertSetting('activeTheme', SETTING_DEFAULTS.activeTheme);
  await upsertSetting(
    'pluginOrder',
    DEFAULT_PLUGIN_ORDER.length ? DEFAULT_PLUGIN_ORDER : ['sample-analytics']
  );
  await upsertSetting(
    'enabledPlugins',
    DEFAULT_ENABLED_PLUGINS.length
      ? DEFAULT_ENABLED_PLUGINS
      : ['sample-analytics']
  );

  console.log('Settings seeded.');

  const categories = [
    {
      id: 'seed-cat-audio-electronics',
      slug: 'audio-electronics',
      title: 'Audio & electronics',
      description: 'Speakers, headphones, and small gadgets for work and play.',
      position: 1,
    },
    {
      id: 'seed-cat-apparel',
      slug: 'apparel',
      title: 'Apparel',
      description: 'Comfortable everyday clothing and layering pieces.',
      position: 2,
    },
    {
      id: 'seed-cat-home-decor',
      slug: 'home-decor',
      title: 'Home décor',
      description: 'Lighting, accents, and pieces that personalize your space.',
      position: 3,
    },
    {
      id: 'seed-cat-kitchenware',
      slug: 'kitchenware',
      title: 'Kitchenware',
      description: 'Mugs, prep tools, and staples for cooking at home.',
      position: 4,
    },
    {
      id: 'seed-cat-outdoor-living',
      slug: 'outdoor-living',
      title: 'Outdoor living',
      description: 'Gear for patios, gardens, and weekend adventures.',
      position: 5,
    },
    {
      id: 'seed-cat-wellness',
      slug: 'wellness',
      title: 'Wellness',
      description: 'Relaxation, recovery, and mindful routines.',
      position: 6,
    },
    {
      id: 'seed-cat-sports',
      slug: 'sports',
      title: 'Sports gear',
      description: 'Training essentials and active lifestyle accessories.',
      position: 7,
    },
    {
      id: 'seed-cat-pets',
      slug: 'pets',
      title: 'Pet care',
      description: 'Leashes, bowls, and everyday items for companion animals.',
      position: 8,
    },
    {
      id: 'seed-cat-gifts',
      slug: 'gifts',
      title: 'Gifts & specialty',
      description:
        'Curated picks for holidays, thank-yous, and treat-yourself moments.',
      position: 9,
    },
  ];

  for (const c of categories) {
    await upsertCategory(c);
  }
  console.log(`Seeded ${categories.length} categories.`);

  const products = [
    {
      id: 'seed-prod-bamboo-speaker',
      variantId: 'seed-prod-bamboo-speaker-var',
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
        ['seed-cat-audio-electronics', 0],
        ['seed-cat-gifts', 1],
      ],
    },
    {
      id: 'seed-prod-organic-tee',
      variantId: 'seed-prod-organic-tee-var',
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
      categories: [['seed-cat-apparel', 0]],
    },
    {
      id: 'seed-prod-stoneware-mugs',
      variantId: 'seed-prod-stoneware-mugs-var',
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
        ['seed-cat-kitchenware', 0],
        ['seed-cat-home-decor', 1],
      ],
    },
    {
      id: 'seed-prod-led-desk-lamp',
      variantId: 'seed-prod-led-desk-lamp-var',
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
        ['seed-cat-home-decor', 0],
        ['seed-cat-audio-electronics', 1],
      ],
    },
    {
      id: 'seed-prod-yoga-mat',
      variantId: 'seed-prod-yoga-mat-var',
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
        ['seed-cat-wellness', 0],
        ['seed-cat-sports', 1],
      ],
    },
    {
      id: 'seed-prod-hydration-pack',
      variantId: 'seed-prod-hydration-pack-var',
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
        ['seed-cat-outdoor-living', 0],
        ['seed-cat-sports', 1],
      ],
    },
    {
      id: 'seed-prod-herbal-tea',
      variantId: 'seed-prod-herbal-tea-var',
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
        ['seed-cat-wellness', 0],
        ['seed-cat-gifts', 1],
      ],
    },
    {
      id: 'seed-prod-dog-leash-set',
      variantId: 'seed-prod-dog-leash-set-var',
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
      categories: [['seed-cat-pets', 0]],
    },
    {
      id: 'seed-prod-ceramic-pots',
      variantId: 'seed-prod-ceramic-pots-var',
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
        ['seed-cat-home-decor', 0],
        ['seed-cat-outdoor-living', 1],
      ],
    },
  ];

  // Legacy demo product slug kept for older bookmarks (same ID as former single demo product).
  const legacyDemo = {
    id: 'seed-demo-product',
    variantId: 'seed-demo-variant',
    slug: 'demo-product',
    sku: 'DEMO-001',
    title: 'Demo product',
    description:
      'Starter catalog item retained for backwards-compatible demo links.',
    position: 10,
    inventoryCount: 100,
    categories: [['seed-cat-gifts', 2]],
  };
  await upsertProduct(legacyDemo);
  for (const [categoryId, pos] of legacyDemo.categories) {
    await linkProductToCategory(legacyDemo.id, categoryId, pos);
  }

  for (const p of products) {
    const { categories: catTuples, ...rest } = p;
    await upsertProduct(rest);
    for (const [categoryId, pos] of catTuples) {
      await linkProductToCategory(p.id, categoryId, pos);
    }
  }

  console.log(
    `Seeded ${products.length} demo products (${legacyDemo.id} retained).`
  );

  // W5: CMS pages and navigation menus
  const aboutPage = await prisma.page.upsert({
    where: { id: 'seed-page-about' },
    create: {
      id: 'seed-page-about',
      status: 'published',
      publishedAt: new Date(),
      position: 0,
    },
    update: { status: 'published', publishedAt: new Date() },
  });
  await upsertSlug('page', aboutPage.id, 'about');
  await upsertTranslation('page', aboutPage.id, 'title', 'About Us');
  await upsertTranslation(
    'page',
    aboutPage.id,
    'body',
    'Bermooda is a curated home and lifestyle shop. We source thoughtful goods for everyday living.'
  );

  const shippingPage = await prisma.page.upsert({
    where: { id: 'seed-page-shipping' },
    create: {
      id: 'seed-page-shipping',
      status: 'published',
      publishedAt: new Date(),
      position: 1,
    },
    update: { status: 'published', publishedAt: new Date() },
  });
  await upsertSlug('page', shippingPage.id, 'shipping-policy');
  await upsertTranslation('page', shippingPage.id, 'title', 'Shipping Policy');
  await upsertTranslation(
    'page',
    shippingPage.id,
    'body',
    'Orders ship within 2 business days. Free shipping on orders over $75.'
  );

  const subHeaderMenu = await prisma.menu.upsert({
    where: { handle: 'sub-header' },
    create: { handle: 'sub-header', title: 'Sub header' },
    update: { title: 'Sub header' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: subHeaderMenu.id } });
  await prisma.menuItem.createMany({
    data: [
      {
        menuId: subHeaderMenu.id,
        label: 'Gift Guide',
        pageId: aboutPage.id,
        position: 0,
      },
      {
        menuId: subHeaderMenu.id,
        label: 'Trade Program',
        url: '/about',
        position: 1,
      },
      {
        menuId: subHeaderMenu.id,
        label: 'Stores',
        pageId: shippingPage.id,
        position: 2,
      },
    ],
  });

  const footerMenu = await prisma.menu.upsert({
    where: { handle: 'footer' },
    create: { handle: 'footer', title: 'Footer' },
    update: { title: 'Footer' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: footerMenu.id } });
  await prisma.menuItem.createMany({
    data: [
      {
        menuId: footerMenu.id,
        label: 'Shipping',
        pageId: shippingPage.id,
        position: 0,
      },
      {
        menuId: footerMenu.id,
        label: 'About',
        pageId: aboutPage.id,
        position: 1,
      },
      {
        menuId: footerMenu.id,
        label: 'Account',
        url: '/account/login',
        position: 2,
      },
    ],
  });

  const mainMenu = await prisma.menu.upsert({
    where: { handle: 'main' },
    create: { handle: 'main', title: 'Main' },
    update: { title: 'Main' },
  });
  await prisma.menuItem.deleteMany({ where: { menuId: mainMenu.id } });
  await prisma.menuItem.createMany({
    data: [
      { menuId: mainMenu.id, label: 'Home', url: '/', position: 0 },
      {
        menuId: mainMenu.id,
        label: 'About',
        pageId: aboutPage.id,
        position: 1,
      },
    ],
  });

  console.log('W5 CMS pages and menus seeded.');

  // W7: default location + inventory levels from variant counts
  const defaultLocation = await prisma.location.upsert({
    where: { code: 'default' },
    create: {
      name: 'Default Warehouse',
      code: 'default',
      isDefault: true,
      active: true,
    },
    update: { isDefault: true, active: true },
  });

  const variants = await prisma.productVariant.findMany({
    select: { id: true, inventoryCount: true },
  });
  for (const variant of variants) {
    await prisma.inventoryLevel.upsert({
      where: {
        variantId_locationId: {
          variantId: variant.id,
          locationId: defaultLocation.id,
        },
      },
      create: {
        variantId: variant.id,
        locationId: defaultLocation.id,
        quantity: variant.inventoryCount,
      },
      update: { quantity: variant.inventoryCount },
    });
  }

  await prisma.giftCard.upsert({
    where: { code: 'WELCOME25' },
    create: {
      code: 'WELCOME25',
      initialBalanceCents: 2500,
      balanceCents: 2500,
      currency: 'USD',
      status: 'active',
    },
    update: {},
  });

  console.log('W7 inventory, location, and sample gift card seeded.');

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
