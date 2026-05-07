import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

import { PrismaClient } from './generated/client.ts';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function upsertSetting(key, value) {
  const serialized = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: serialized },
    update: { value: serialized },
  });
}

async function main() {
  console.log('Seeding database…');

  // ── Admin user ──────────────────────────────────────────────────────────────
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

  // ── Settings defaults ───────────────────────────────────────────────────────
  await upsertSetting('defaultCurrency', 'USD');
  await upsertSetting('currencies', ['USD', 'EUR', 'AUD']);
  await upsertSetting('defaultLocale', 'en');
  await upsertSetting('activeTheme', 'default');
  await upsertSetting('pluginOrder', ['sample-analytics']);
  await upsertSetting('enabledPlugins', ['sample-analytics']);

  console.log('Settings seeded.');

  // ── Demo product ────────────────────────────────────────────────────────────
  const demoProduct = await prisma.product.upsert({
    where: { id: 'seed-demo-product' },
    create: {
      id: 'seed-demo-product',
      publishedAt: new Date(),
      position: 1,
      variants: {
        create: {
          id: 'seed-demo-variant',
          sku: 'DEMO-001',
          inventoryCount: 100,
          inventoryTracked: true,
          position: 1,
          prices: {
            createMany: {
              data: [
                { currency: 'USD', priceCents: 2999 },
                { currency: 'EUR', priceCents: 2799 },
                { currency: 'AUD', priceCents: 4499 },
              ],
            },
          },
        },
      },
    },
    update: {},
  });

  // Slug for demo product
  await prisma.slug.upsert({
    where: {
      entityType_entityId_locale: {
        entityType: 'product',
        entityId: demoProduct.id,
        locale: 'en',
      },
    },
    create: {
      entityType: 'product',
      entityId: demoProduct.id,
      locale: 'en',
      slug: 'demo-product',
      canonical: true,
    },
    update: {},
  });

  // Translations for demo product
  await prisma.translation.upsert({
    where: {
      entityType_entityId_locale_field: {
        entityType: 'product',
        entityId: demoProduct.id,
        locale: 'en',
        field: 'title',
      },
    },
    create: {
      entityType: 'product',
      entityId: demoProduct.id,
      locale: 'en',
      field: 'title',
      value: 'Demo Product',
    },
    update: { value: 'Demo Product' },
  });

  await prisma.translation.upsert({
    where: {
      entityType_entityId_locale_field: {
        entityType: 'product',
        entityId: demoProduct.id,
        locale: 'en',
        field: 'description',
      },
    },
    create: {
      entityType: 'product',
      entityId: demoProduct.id,
      locale: 'en',
      field: 'description',
      value: 'A demo product for testing the bermooda storefront.',
    },
    update: { value: 'A demo product for testing the bermooda storefront.' },
  });

  console.log(`Demo product seeded (id: ${demoProduct.id})`);

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
