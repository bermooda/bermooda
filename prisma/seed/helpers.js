/**
 * Shared seed helpers (plain Node — no Vite `#/` aliases).
 */

export const PRICE_CURRENCIES = [
  { currency: 'USD', priceCents: 2999 },
  { currency: 'EUR', priceCents: 2799 },
  { currency: 'AUD', priceCents: 4499 },
];

export const DEMO_ADDRESS = {
  firstName: 'Alex',
  lastName: 'Rivera',
  line1: '123 Market Street',
  line2: 'Suite 4',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
  country: 'US',
  phone: '+1-415-555-0100',
};

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {string} key
 * @param {unknown} value
 */
export async function upsertSetting(prisma, key, value) {
  const serialized = JSON.stringify(value);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: serialized },
    update: { value: serialized },
  });
}

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} slug
 * @param {string} [locale]
 */
export async function upsertSlug(
  prisma,
  entityType,
  entityId,
  slug,
  locale = 'en'
) {
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

/**
 * @param {import('../generated/client.ts').PrismaClient} prisma
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} field
 * @param {string} value
 * @param {string} [locale]
 */
export async function upsertTranslation(
  prisma,
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

/**
 * @param {number} daysAgo
 * @returns {Date}
 */
export function daysAgo(daysAgoCount) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgoCount);
  return d;
}

/**
 * @param {Partial<typeof DEMO_ADDRESS>} [overrides]
 * @returns {string}
 */
export function addressJson(overrides = {}) {
  return JSON.stringify({ ...DEMO_ADDRESS, ...overrides });
}
