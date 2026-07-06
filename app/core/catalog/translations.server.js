// Translation field helpers shared by catalog, content, and search.

import prisma from '#/libs/prisma.server';

export function toTranslationMap(rows) {
  return Object.fromEntries(rows.map((r) => [r.field, r.value]));
}

export function withTranslations(base, translationMap) {
  return { ...base, ...translationMap };
}

export async function setTranslation(
  entityType,
  entityId,
  locale,
  field,
  value
) {
  await prisma.translation.upsert({
    where: {
      entityType_entityId_locale_field: { entityType, entityId, locale, field },
    },
    create: { entityType, entityId, locale, field, value },
    update: { value },
  });
}

export async function getTranslations(entityType, entityId, locale) {
  const rows = await prisma.translation.findMany({
    where: { entityType, entityId, locale },
  });
  return toTranslationMap(rows);
}

/**
 * Batch-load product title translations for CSV exports and reports.
 *
 * @param {string[]} productIds
 * @param {string} [locale='en']
 * @returns {Promise<Map<string, string>>}
 */
export async function loadProductTitleMap(productIds, locale = 'en') {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const rows = await prisma.translation.findMany({
    where: {
      entityType: 'product',
      entityId: { in: uniqueIds },
      locale,
      field: 'title',
    },
    select: { entityId: true, value: true },
  });

  return new Map(rows.map((row) => [row.entityId, row.value]));
}
