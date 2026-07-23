// app/core/storage/index.server.js
//
// Public-facing wrapper around the S3-compatible storage client.
// Re-exports the low-level primitives and adds uploadMedia() for
// handling Web API File objects from browser form uploads.

import sharp from 'sharp';

import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import * as client from '#/core/storage/client/index.server';
import {
  collectStorageKeys,
  RESPONSIVE_WIDTHS,
  serializeMediaRecord,
} from '#/core/storage/media/index';

export {
  collectStorageKeys,
  DEFAULT_MEDIA_WIDTH,
  parseMediaVariants,
  pickMediaRecord,
  resolveCatalogMediaUrl,
  resolveMediaUrl,
  RESPONSIVE_WIDTHS,
  serializeMediaRecord,
} from '#/core/storage/media/index';

export const putObject = client.putObject;
export const getObjectUrl = client.getObjectUrl;
export const deleteObject = client.deleteObject;
export const isStorageConfigured = client.isStorageConfigured;

const IMAGE_MIME_PREFIX = 'image/';

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
// Input parsing
// ---------------------------------------------------------------------------

/**
 * Validate a browser upload from FormData.
 *
 * @param {FormDataEntryValue|null} file
 */
export function parseUploadFileInput(file) {
  if (!file || typeof file === 'string') {
    throw Object.assign(new Error('No file provided.'), {
      code: 'FILE_REQUIRED',
    });
  }
  return file;
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
  const validFile = parseUploadFileInput(file);
  const ext = getExtension(validFile.name ?? '', validFile.type);
  const storageKey = `media/${Date.now()}-${randomSuffix()}.${ext}`;

  logger.info(
    { storageKey, mimeType: validFile.type },
    'uploadMedia: uploading file'
  );

  const buffer = Buffer.from(await validFile.arrayBuffer());
  const url = await client.putObject(storageKey, buffer, validFile.type, {
    cacheControl: cacheControlForMime(validFile.type),
  });

  let width = null;
  let height = null;
  let variantsJson = null;

  if (isOptimizableImage(validFile.type)) {
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
    mimeType: validFile.type,
    width,
    height,
    variantsJson,
  };
}

// ---------------------------------------------------------------------------
// Media records
// ---------------------------------------------------------------------------

/**
 * Delete all storage objects referenced by a media record.
 *
 * @param {{ storageKey?: string|null, variantsJson?: string|null }} media
 */
export async function deleteStoredObjects(media) {
  if (!isStorageConfigured()) return;

  const keys = collectStorageKeys(media);
  await Promise.all(
    keys.map((key) =>
      deleteObject(key).catch((err) => {
        logger.warn(
          { err, key },
          'deleteStoredObjects: failed to delete object'
        );
      })
    )
  );
}

/**
 * Persist an upload result as a Media row.
 *
 * @param {Awaited<ReturnType<typeof uploadMedia>>} uploadResult
 */
export async function createMediaRecord(uploadResult) {
  const media = await prisma.media.create({
    data: {
      storageKey: uploadResult.storageKey,
      url: uploadResult.url,
      mimeType: uploadResult.mimeType,
      width: uploadResult.width,
      height: uploadResult.height,
      variantsJson: uploadResult.variantsJson,
    },
  });

  return serializeMediaRecord(media);
}

/**
 * Upload a file and persist the resulting Media row.
 *
 * @param {FormDataEntryValue|null} file
 */
export async function uploadAndCreateMedia(file) {
  const uploadResult = await uploadMedia(file);
  return createMediaRecord(uploadResult);
}

/**
 * Load a Media record by id.
 *
 * @param {string} mediaId
 */
export async function getMedia(mediaId) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) {
    throw Object.assign(new Error('Media not found.'), { code: 'NOT_FOUND' });
  }
  return serializeMediaRecord(media);
}

/**
 * Delete a Media row and its storage objects.
 *
 * @param {string} mediaId
 */
export async function deleteMedia(mediaId) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) {
    throw Object.assign(new Error('Media not found.'), { code: 'NOT_FOUND' });
  }

  await deleteStoredObjects(media);
  await prisma.media.delete({ where: { id: mediaId } });
}

/**
 * Return whether storage credentials are configured.
 */
export function loadStorageStatus() {
  return { configured: isStorageConfigured() };
}
