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
