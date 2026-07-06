// app/core/storage/index.server.js
//
// Public-facing wrapper around the S3-compatible storage client.
// Re-exports the low-level primitives and adds uploadMedia() for
// handling Web API File objects from browser form uploads.

import sharp from 'sharp';

import logger from '#/utils/logger.server';
import * as client from '#/core/storage/client.server';

export const putObject = client.putObject;
export const getObjectUrl = client.getObjectUrl;
export const deleteObject = client.deleteObject;

const IMAGE_MIME_PREFIX = 'image/';
const RESPONSIVE_WIDTHS = [640, 1280];

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function getExtension(filename, mimeType) {
  const fromName = filename.split('.').pop()?.toLowerCase();
  if (fromName && fromName !== filename.toLowerCase()) return fromName;
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
  };
  return mimeMap[mimeType] ?? 'bin';
}

function isOptimizableImage(mimeType) {
  return mimeType.startsWith(IMAGE_MIME_PREFIX) && mimeType !== 'image/svg+xml';
}

function cacheControlForMime(mimeType) {
  if (mimeType.startsWith(IMAGE_MIME_PREFIX)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=86400';
}

async function generateResponsiveVariants(buffer, baseKey) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const variants = {};

  for (const width of RESPONSIVE_WIDTHS) {
    if (metadata.width && metadata.width <= width) continue;

    const variantKey = baseKey.replace(/(\.[^.]+)?$/, `-${width}w.webp`);
    const resized = await sharp(buffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const url = await client.putObject(variantKey, resized, 'image/webp', {
      cacheControl: cacheControlForMime('image/webp'),
    });

    variants[String(width)] = {
      url,
      storageKey: variantKey,
      width,
      mimeType: 'image/webp',
    };
  }

  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    variants,
  };
}

// ---------------------------------------------------------------------------
// uploadMedia
// ---------------------------------------------------------------------------

/**
 * Upload a Web API File object to storage and return metadata.
 *
 * @param {File} file - Web API File object from a browser upload.
 * @returns {Promise<{ url: string, storageKey: string, mimeType: string, width: number|null, height: number|null, variantsJson: string|null }>}
 */
export async function uploadMedia(file) {
  const ext = getExtension(file.name ?? '', file.type);
  const storageKey = `media/${Date.now()}-${randomSuffix()}.${ext}`;

  logger.info(
    { storageKey, mimeType: file.type },
    'uploadMedia: uploading file'
  );

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await client.putObject(storageKey, buffer, file.type, {
    cacheControl: cacheControlForMime(file.type),
  });

  let width = null;
  let height = null;
  let variantsJson = null;

  if (isOptimizableImage(file.type)) {
    try {
      const result = await generateResponsiveVariants(buffer, storageKey);
      width = result.width;
      height = result.height;
      if (Object.keys(result.variants).length > 0) {
        variantsJson = JSON.stringify(result.variants);
      }
    } catch (err) {
      logger.warn(
        { err, storageKey },
        'uploadMedia: image optimization failed'
      );
    }
  }

  return {
    url,
    storageKey,
    mimeType: file.type,
    width,
    height,
    variantsJson,
  };
}

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
 * @param {number} targetWidth
 */
export function resolveMediaUrl(media, targetWidth = 640) {
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
