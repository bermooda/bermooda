// Canonical slug lookup and localized entity hydration.

import prisma from '#/libs/prisma.server';

import {
  getTranslations,
  withTranslations,
} from '#/core/catalog/translations.server';

export async function fetchCanonicalSlug(entityType, entityId, locale) {
  const slugRow = await prisma.slug.findFirst({
    where: { entityType, entityId, locale, canonical: true },
  });
  return slugRow?.slug ?? null;
}

/**
 * Merge locale translations and canonical slug onto a base entity record.
 */
export async function localizeEntity(entityType, entityId, locale, base) {
  const [translations, slug] = await Promise.all([
    getTranslations(entityType, entityId, locale),
    fetchCanonicalSlug(entityType, entityId, locale),
  ]);
  return withTranslations({ ...base, slug }, translations);
}
