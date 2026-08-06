import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import pg from 'pg';

import { PrismaClient } from './generated/client.ts';
import { seedB2b } from './seed/b2b.js';
import { seedCatalog } from './seed/catalog.js';
import { seedChannels } from './seed/channels.js';
import { seedCommerceExtras } from './seed/commerce.js';
import { seedContent } from './seed/content.js';
import { seedCustomers } from './seed/customers.js';
import { seedDiscounts } from './seed/discounts.js';
import { upsertSetting } from './seed/helpers.js';
import { seedInventory } from './seed/inventory.js';
import { seedLoyalty } from './seed/loyalty.js';
import { seedMarketing } from './seed/marketing.js';
import { seedOps } from './seed/ops.js';
import { seedOrders } from './seed/orders.js';
import { seedReviews } from './seed/reviews.js';
import { seedSubscriptionsPos } from './seed/subscriptions-pos.js';

// Inline seed defaults so `node prisma/seed.js` works without Vite `#/` aliases.
// Keep in sync with app/core/settings/defaults.js where practical.
const DEFAULT_ENABLED_PLUGINS = ['@bermooda/plugin-resend'];
const DEFAULT_PLUGIN_ORDER = ['@bermooda/plugin-resend'];
const SETTING_DEFAULTS = {
  defaultCurrency: 'USD',
  currencies: ['USD', 'EUR', 'AUD'],
  defaultLocale: 'en',
  locales: ['en', 'de', 'fr'],
  activeTheme: '@bermooda/theme-default',
  pluginOrder: DEFAULT_PLUGIN_ORDER,
};

/**
 * Resolve DB provider from DATABASE_PROVIDER or DATABASE_URL.
 * @returns {'sqlite' | 'postgresql'}
 */
function getDatabaseProvider() {
  const explicit = process.env.DATABASE_PROVIDER?.trim().toLowerCase();
  if (explicit === 'postgresql' || explicit === 'postgres') {
    return 'postgresql';
  }
  if (explicit === 'sqlite') {
    return 'sqlite';
  }
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql';
  }
  return 'sqlite';
}

/**
 * Create Prisma client with the adapter matching env (SQLite or PostgreSQL).
 * Required for @bermooda/cli --server installs; seed previously hard-coded SQLite.
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for seed / cli-bootstrap');
  }
  const provider = getDatabaseProvider();
  if (provider === 'postgresql') {
    const pool = new pg.Pool({ connectionString: databaseUrl });
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });
}

const prisma = createPrismaClient();
const minimalSeed =
  process.env.BERMOODA_MINIMAL_SEED === '1' ||
  process.env.BERMOODA_MINIMAL_SEED === 'true';

/**
 * Create a one-time bootstrap API key when none exist.
 * Mirrors app/core/api-keys (seed cannot use #/ Vite aliases).
 * @returns {Promise<string|null>} raw key or null when skipped
 */
async function createBootstrapApiKeyIfNeeded() {
  const existing = await prisma.apiKey.count();
  if (existing > 0) {
    console.log(
      'API keys already exist; skipping bootstrap key (use Admin API or UI).'
    );
    return null;
  }

  const { createHash, randomBytes } = await import('node:crypto');
  const rawKey = 'berm_' + randomBytes(32).toString('hex');
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const record = await prisma.apiKey.create({
    data: {
      label: 'bootstrap',
      keyHash,
      scopes: JSON.stringify(['admin']),
    },
  });

  console.log('');
  console.log('Bootstrap API key created (shown once — store securely):');
  console.log(`  ${rawKey}`);
  console.log(`  id: ${record.id}`);
  console.log('');
  console.log('Agent / MCP config snippet:');
  console.log(
    JSON.stringify(
      {
        BERMOODA_URL: process.env.BERMOODA_URL || 'http://localhost:3000',
        BERMOODA_API_KEY: rawKey,
      },
      null,
      2
    )
  );
  console.log('');

  try {
    const {
      mkdirSync,
      writeFileSync,
      appendFileSync,
      existsSync,
      readFileSync,
    } = await import('node:fs');
    const { join } = await import('node:path');
    const shopRoot = process.cwd();
    const bermoodaDir = join(shopRoot, '.bermooda');
    mkdirSync(bermoodaDir, { recursive: true });
    writeFileSync(join(bermoodaDir, 'bootstrap-api-key'), `${rawKey}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    console.log(
      'Wrote .bermooda/bootstrap-api-key for CLI `bermooda mcp init`.'
    );

    const envPath = join(shopRoot, '.env');
    if (existsSync(envPath)) {
      const envText = readFileSync(envPath, 'utf8');
      if (!/^BERMOODA_API_KEY=/m.test(envText)) {
        appendFileSync(
          envPath,
          `\n# Bootstrap Admin API key (from seed; rotate in production)\nBERMOODA_API_KEY=${rawKey}\n`
        );
        console.log('Appended BERMOODA_API_KEY to .env');
      }
    }
  } catch (err) {
    console.warn(
      'Could not write bootstrap key file:',
      err instanceof Error ? err.message : err
    );
  }

  return rawKey;
}

async function main() {
  console.log(
    `Seeding database… (provider=${getDatabaseProvider()}${minimalSeed ? ', minimal' : ''})`
  );

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@bermooda.dev';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123!';
  const shopName = process.env.SEED_SHOP_NAME ?? null;
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Admin',
      emailVerified: true,
      role: 'admin',
      // Skip 2FA until email is configured; enable from Admin → Security.
      twoFactorEnabled: false,
    },
    update: { role: 'admin', emailVerified: true, twoFactorEnabled: false },
  });

  // Keep credential password in sync on re-seed / CLI re-bootstrap.
  // Handle orphaned Account rows (unique on providerId+accountId) from prior DBs.
  const credential = await prisma.account.findFirst({
    where: {
      OR: [
        { userId: admin.id, providerId: 'credential' },
        { providerId: 'credential', accountId: adminEmail },
      ],
    },
  });
  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: {
        userId: admin.id,
        accountId: adminEmail,
        password: passwordHash,
      },
    });
  } else {
    await prisma.account.create({
      data: {
        userId: admin.id,
        accountId: adminEmail,
        providerId: 'credential',
        password: passwordHash,
      },
    });
  }

  console.log(`Admin user: ${admin.email} (id: ${admin.id})`);

  await upsertSetting(prisma, 'adminSetupComplete', true);
  await upsertSetting(
    prisma,
    'defaultCurrency',
    SETTING_DEFAULTS.defaultCurrency
  );
  await upsertSetting(prisma, 'currencies', SETTING_DEFAULTS.currencies);
  await upsertSetting(prisma, 'defaultLocale', SETTING_DEFAULTS.defaultLocale);
  await upsertSetting(prisma, 'locales', SETTING_DEFAULTS.locales);
  await upsertSetting(prisma, 'activeTheme', SETTING_DEFAULTS.activeTheme);
  await upsertSetting(prisma, 'pluginOrder', DEFAULT_PLUGIN_ORDER);
  await upsertSetting(prisma, 'enabledPlugins', DEFAULT_ENABLED_PLUGINS);

  if (shopName) {
    await upsertSetting(prisma, 'shopName', shopName);
    console.log(`Shop name setting: ${shopName}`);
  } else {
    await upsertSetting(prisma, 'shopName', 'Bermooda Demo');
  }

  console.log('Settings seeded.');
  await createBootstrapApiKeyIfNeeded();

  if (minimalSeed) {
    console.log('Minimal seed complete (demo catalog skipped).');
    return;
  }

  // Demo dataset — dependency order matters for FKs.
  await seedCatalog(prisma);
  await seedContent(prisma);
  await seedInventory(prisma);
  await seedChannels(prisma);
  await seedCustomers(prisma);
  await seedDiscounts(prisma);
  await seedOrders(prisma);
  await seedCommerceExtras(prisma);
  await seedReviews(prisma);
  await seedMarketing(prisma);
  await seedLoyalty(prisma);
  await seedB2b(prisma);
  await seedSubscriptionsPos(prisma, admin.id);
  await seedOps(prisma, {
    adminEmail: admin.email,
    adminUserId: admin.id,
  });

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
