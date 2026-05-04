// app/core/storage/client.server.js
//
// Minimal S3-compatible storage client using the Fetch API.
// For production use, add @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
// to get proper AWS Signature V4 signing instead of plain PUT requests.

const ENDPOINT = process.env.STORAGE_ENDPOINT;
// eslint-disable-next-line no-unused-vars -- needed when upgrading to AWS SDK v3
const _REGION = process.env.STORAGE_REGION ?? 'auto';
const BUCKET = process.env.STORAGE_BUCKET;
const ACCESS_KEY = process.env.STORAGE_ACCESS_KEY;
const SECRET_KEY = process.env.STORAGE_SECRET_KEY;
const PUBLIC_URL = process.env.STORAGE_PUBLIC_URL;

function isConfigured() {
  return Boolean(ENDPOINT && BUCKET && ACCESS_KEY && SECRET_KEY);
}

export async function putObject(key, body, contentType) {
  if (!isConfigured()) {
    throw new Error(
      'Storage is not configured. Set STORAGE_* environment variables.'
    );
  }
  // Minimal S3-compatible PUT using fetch
  const url = `${ENDPOINT}/${BUCKET}/${key}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      // Note: production deployments should use proper AWS Signature V4 signing.
      // Tigris on Fly.io supports pre-signed URLs generated via the AWS SDK.
      'x-amz-acl': 'public-read',
    },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Storage PUT failed: ${response.status} ${response.statusText}`
    );
  }
  return getObjectUrl(key);
}

export function getObjectUrl(key) {
  const base = PUBLIC_URL ?? `${ENDPOINT}/${BUCKET}`;
  return `${base}/${key}`;
}

export async function deleteObject(key) {
  if (!isConfigured()) {
    throw new Error(
      'Storage is not configured. Set STORAGE_* environment variables.'
    );
  }
  const url = `${ENDPOINT}/${BUCKET}/${key}`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Storage DELETE failed: ${response.status} ${response.statusText}`
    );
  }
}
