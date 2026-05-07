// app/core/storage/index.server.js
//
// Public-facing wrapper around the S3-compatible storage client.
// Re-exports the low-level primitives and adds uploadMedia() for
// handling Web API File objects from browser form uploads.

import logger from '#/utils/logger.server';

import * as client from '#/core/storage/client.server';

export const putObject = client.putObject;
export const getObjectUrl = client.getObjectUrl;
export const deleteObject = client.deleteObject;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

function getExtension(filename, mimeType) {
  // Try filename extension first
  const fromName = filename.split('.').pop()?.toLowerCase();
  if (fromName && fromName !== filename.toLowerCase()) return fromName;
  // Fall back to MIME type
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

// ---------------------------------------------------------------------------
// uploadMedia
// ---------------------------------------------------------------------------

/**
 * Upload a Web API File object to storage and return metadata.
 *
 * @param {File} file - Web API File object from a browser upload.
 * @returns {Promise<{ url: string, storageKey: string, mimeType: string, width: null, height: null }>}
 */
export async function uploadMedia(file) {
  const ext = getExtension(file.name ?? '', file.type);
  const storageKey = `media/${Date.now()}-${randomSuffix()}.${ext}`;

  logger.info(
    { storageKey, mimeType: file.type },
    'uploadMedia: uploading file'
  );

  const buffer = await file.arrayBuffer();
  const url = await client.putObject(storageKey, buffer, file.type);

  // Image dimension detection skipped — no sharp/probe-image-size installed.
  // width and height will be populated by a future enhancement.

  return {
    url,
    storageKey,
    mimeType: file.type,
    width: null,
    height: null,
  };
}
