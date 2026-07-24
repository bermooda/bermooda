# Storage

bermooda uses S3-compatible object storage for product media and other uploads. Storage is **manually configured** — the app reads explicit environment variables; it does not auto-provision buckets.

## Environment variables

| Variable             | Description                         | Example                                   |
| -------------------- | ----------------------------------- | ----------------------------------------- |
| `STORAGE_ENDPOINT`   | S3-compatible endpoint URL          | `https://s3.amazonaws.com`                |
| `STORAGE_REGION`     | Storage region                      | `us-east-1`                               |
| `STORAGE_BUCKET`     | Bucket name                         | `bermooda-media`                          |
| `STORAGE_ACCESS_KEY` | Access key ID                       | —                                         |
| `STORAGE_SECRET_KEY` | Secret access key                   | —                                         |
| `STORAGE_PUBLIC_URL` | Public base URL for serving objects | `https://bermooda-media.s3.amazonaws.com` |

## Local development

In local development, `STORAGE_*` variables are not required for routes that don't upload media. The storage client will throw a descriptive error if unconfigured code paths are hit.

To test storage locally, you can use [MinIO](https://min.io/) as a local S3-compatible service:

```
docker run -p 9000:9000 -p 9001:9001 quay.io/minio/minio server /data --console-address ":9001"
```

Set `STORAGE_ENDPOINT=http://localhost:9000` and create a bucket via the MinIO console.

## Failure modes

- **Missing env vars**: `putObject` / `deleteObject` throw `Error: Storage is not configured.`
- **Upload failure**: `putObject` throws with the HTTP status and message from the storage provider.
- **Missing object**: `deleteObject` treats 404 as success (idempotent).
- **`getObjectUrl`**: Pure URL construction — never throws, works even without configured credentials.

## Storage key convention

Uploaded media objects are stored under the key pattern:

```
media/{timestamp}-{randomSuffix}.{ext}
```

- `timestamp` — `Date.now()` at upload time
- `randomSuffix` — random alphanumeric string for collision avoidance
- `ext` — derived from the original filename; falls back to the MIME type if no extension is present

Keys are stored in `Media.storageKey` in the database so they can be used to delete the object when a media record is removed.

## API

The storage layer is split into two modules:

- `app/core/storage/client/index.server.js` — low-level S3-compatible primitives
- `app/core/storage/index.server.js` — public API that re-exports the primitives and adds `uploadMedia`

### Low-level primitives (`client.server.js`)

```js
putObject(key, body, contentType); // → Promise<string> (public URL)
getObjectUrl(key); // → string
deleteObject(key); // → Promise<void>
```

`putObject` performs a plain HTTP PUT with the `x-amz-acl: public-read` header. This is sufficient for MinIO in development and many S3-compatible providers. For production deployments that require proper AWS Signature V4 request signing, replace the fetch-based implementation with `@aws-sdk/client-s3` (`PutObjectCommand`).

### High-level API (`index.server.js`)

```js
parseUploadFileInput(file); // validate FormData file
uploadMedia(file); // → Promise<{ url, storageKey, mimeType, width, height, variantsJson }>
uploadAndCreateMedia(file); // upload + persist Media row
createMediaRecord(uploadResult); // persist upload metadata
getMedia(mediaId); // load Media row (404 when missing)
deleteMedia(mediaId); // delete storage objects + Media row
deleteStoredObjects(media); // delete primary + variant objects
loadStorageStatus(); // → { configured: boolean }
isStorageConfigured(); // boolean env check
```

`uploadMedia` accepts a Web API `File` object (as received from a browser form upload):

- Generates a storage key following the `media/{timestamp}-{random}.{ext}` convention
- Calls `putObject` internally
- Generates responsive WebP variants at 640px and 1280px widths for optimizable images (via `sharp`)
- Returns `{ url, storageKey, mimeType, width, height, variantsJson }`

### Client-safe helpers (`media.js`)

```js
parseMediaVariants(variantsJson);
resolveMediaUrl(media, targetWidth);
resolveCatalogMediaUrl(entity, targetWidth);
pickMediaRecord(entry);
serializeMediaRecord(media);
collectStorageKeys(media);
```

Storefront themes and SEO helpers use `resolveCatalogMediaUrl` to serve responsive variant URLs when available.
