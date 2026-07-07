// app/core/storage/media.js
// Client-safe media URL helpers shared by themes, SEO, and server modules.

export const DEFAULT_MEDIA_WIDTH = 640;
export const RESPONSIVE_WIDTHS = [640, 1280];

/**
 * Parse stored responsive variant metadata.
 *
 * @param {string|null|undefined} variantsJson
 */
export function parseMediaVariants(variantsJson) {
  if (!variantsJson) return {};
  try {
    return JSON.parse(variantsJson);
  } catch {
    return {};
  }
}

/**
 * Pick the best variant URL for a target width.
 *
 * @param {{ url: string, variantsJson?: string|null }} media
 * @param {number} [targetWidth]
 */
export function resolveMediaUrl(media, targetWidth = DEFAULT_MEDIA_WIDTH) {
  const variants = parseMediaVariants(media.variantsJson);
  const widths = Object.keys(variants)
    .map(Number)
    .sort((a, b) => a - b);
  const match = widths.find((width) => width >= targetWidth) ?? widths.at(-1);
  if (match && variants[String(match)]?.url) {
    return variants[String(match)].url;
  }
  return media.url;
}

/**
 * Normalize catalog/media relation shapes to a Media record.
 *
 * @param {object|null|undefined} entry
 */
export function pickMediaRecord(entry) {
  if (!entry) return null;
  if (entry.url) return entry;
  if (entry.media?.url) return entry.media;
  if (Array.isArray(entry.media) && entry.media[0]) {
    return entry.media[0].media ?? entry.media[0];
  }
  return null;
}

/**
 * Resolve a responsive media URL from catalog entities or media rows.
 *
 * @param {object|null|undefined} entry
 * @param {number} [targetWidth]
 */
export function resolveCatalogMediaUrl(
  entry,
  targetWidth = DEFAULT_MEDIA_WIDTH
) {
  const record = pickMediaRecord(entry);
  if (!record?.url) return null;
  return resolveMediaUrl(record, targetWidth);
}

/**
 * Serialize a Media record for admin/API responses.
 *
 * @param {object} media
 */
export function serializeMediaRecord(media) {
  return {
    id: media.id,
    storageKey: media.storageKey,
    url: media.url,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    variantsJson: media.variantsJson,
    altText: media.altText ?? null,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

/**
 * Collect all storage keys for a media record, including responsive variants.
 *
 * @param {{ storageKey?: string|null, variantsJson?: string|null }} media
 */
export function collectStorageKeys(media) {
  const keys = [];
  if (media.storageKey) keys.push(media.storageKey);
  const variants = parseMediaVariants(media.variantsJson);
  for (const variant of Object.values(variants)) {
    if (variant?.storageKey) keys.push(variant.storageKey);
  }
  return keys;
}
