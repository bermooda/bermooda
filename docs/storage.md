# Storage

bermooda uses S3-compatible object storage for product media and other uploads. Storage is **manually configured** — the app reads explicit environment variables; it does not auto-provision buckets.

## Environment variables

| Variable             | Description                         | Example                                         |
| -------------------- | ----------------------------------- | ----------------------------------------------- |
| `STORAGE_ENDPOINT`   | S3-compatible endpoint URL          | `https://fly.storage.tigris.dev`                |
| `STORAGE_REGION`     | Storage region                      | `auto`                                          |
| `STORAGE_BUCKET`     | Bucket name                         | `bermooda-media`                                |
| `STORAGE_ACCESS_KEY` | Access key ID                       | —                                               |
| `STORAGE_SECRET_KEY` | Secret access key                   | —                                               |
| `STORAGE_PUBLIC_URL` | Public base URL for serving objects | `https://fly.storage.tigris.dev/bermooda-media` |

## Provisioning on Fly.io (Tigris)

1. Install the Fly CLI: `brew install flyctl`
2. Create a storage bucket: `fly storage create --name bermooda-media`
3. The CLI prints the endpoint, region, access key, and secret key — copy these to your `.env` file and to Fly.io secrets:
   ```
   fly secrets set STORAGE_ENDPOINT=... STORAGE_REGION=... STORAGE_BUCKET=... STORAGE_ACCESS_KEY=... STORAGE_SECRET_KEY=... STORAGE_PUBLIC_URL=...
   ```

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

## API

Defined in `app/core/storage/client.server.js`:

```js
putObject(key, body, contentType); // → Promise<string> (public URL)
getObjectUrl(key); // → string
deleteObject(key); // → Promise<void>
```

Phase 3 (P3-9) will promote this client into `app/core/storage/index.server.js` and add `uploadMedia(file)`.
