// app/core/storage/storage.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client.server', () => ({
  putObject: vi.fn(),
  getObjectUrl: vi.fn(),
  deleteObject: vi.fn(),
}));

// Import after mock registration
import {
  putObject,
  getObjectUrl,
  deleteObject,
  uploadMedia,
} from './index.server.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Web API File-like object for testing.
 */
function makeFile({
  name = 'photo.jpg',
  type = 'image/jpeg',
  content = 'data',
} = {}) {
  return {
    name,
    type,
    arrayBuffer: vi.fn().mockResolvedValue(Buffer.from(content)),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uploadMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    putObject.mockResolvedValue('https://cdn.example.com/media/key.jpg');
  });

  it('calls putObject with a media/<timestamp>-<suffix>.<ext> key, buffer, and mimeType', async () => {
    const file = makeFile({ name: 'photo.jpg', type: 'image/jpeg' });
    await uploadMedia(file);

    expect(putObject).toHaveBeenCalledOnce();
    const [key, body, contentType] = putObject.mock.calls[0];
    expect(key).toMatch(/^media\/\d+-[a-z0-9]+\.jpg$/);
    expect(body).toBeInstanceOf(Buffer);
    expect(contentType).toBe('image/jpeg');
  });

  it('returns { url, storageKey, mimeType, width: null, height: null }', async () => {
    const file = makeFile({ name: 'banner.png', type: 'image/png' });
    putObject.mockResolvedValue('https://cdn.example.com/media/banner.png');

    const result = await uploadMedia(file);

    expect(result.url).toBe('https://cdn.example.com/media/banner.png');
    expect(result.storageKey).toMatch(/^media\/\d+-[a-z0-9]+\.png$/);
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
  });

  it('derives extension from filename when available', async () => {
    const file = makeFile({ name: 'clip.mp4', type: 'video/mp4' });
    await uploadMedia(file);

    const [key] = putObject.mock.calls[0];
    expect(key).toMatch(/\.mp4$/);
  });

  it('falls back to MIME type for extension when filename has no extension', async () => {
    const file = makeFile({ name: 'avatar', type: 'image/webp' });
    await uploadMedia(file);

    const [key] = putObject.mock.calls[0];
    expect(key).toMatch(/\.webp$/);
  });

  it("falls back to 'bin' for unknown MIME type with no filename extension", async () => {
    const file = makeFile({ name: 'data', type: 'application/octet-stream' });
    await uploadMedia(file);

    const [key] = putObject.mock.calls[0];
    expect(key).toMatch(/\.bin$/);
  });
});

describe('re-exports from client.server', () => {
  it('re-exports getObjectUrl and deleteObject', () => {
    expect(typeof getObjectUrl).toBe('function');
    expect(typeof deleteObject).toBe('function');
  });
});
