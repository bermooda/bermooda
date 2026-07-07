// app/core/storage/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/core/storage/client.server', () => ({
  putObject: vi.fn(),
  getObjectUrl: vi.fn(),
  deleteObject: vi.fn(),
  isStorageConfigured: vi.fn(),
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    media: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import prisma from '#/libs/prisma.server';
import {
  putObject,
  getObjectUrl,
  deleteObject,
  isStorageConfigured,
  uploadMedia,
  parseUploadFileInput,
  deleteStoredObjects,
  createMediaRecord,
  uploadAndCreateMedia,
  getMedia,
  deleteMedia,
  loadStorageStatus,
} from '#/core/storage/index.server';

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

describe('parseUploadFileInput', () => {
  it('throws when no file is provided', () => {
    expect(() => parseUploadFileInput(null)).toThrow(/No file provided/);
    expect(() => parseUploadFileInput('filename')).toThrow(/No file provided/);
  });

  it('returns the file when valid', () => {
    const file = makeFile();
    expect(parseUploadFileInput(file)).toBe(file);
  });
});

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

  it('returns upload metadata', async () => {
    const file = makeFile({ name: 'banner.png', type: 'image/png' });
    putObject.mockResolvedValue('https://cdn.example.com/media/banner.png');

    const result = await uploadMedia(file);

    expect(result.url).toBe('https://cdn.example.com/media/banner.png');
    expect(result.storageKey).toMatch(/^media\/\d+-[a-z0-9]+\.png$/);
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.variantsJson).toBeNull();
  });
});

describe('createMediaRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists all upload fields including variantsJson', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');
    prisma.media.create.mockResolvedValue({
      id: 'media_1',
      storageKey: 'media/key.jpg',
      url: 'https://cdn.example.com/media/key.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 800,
      variantsJson: '{"640":{"url":"https://cdn.example.com/key-640w.webp"}}',
      altText: null,
      createdAt,
      updatedAt,
    });

    const result = await createMediaRecord({
      storageKey: 'media/key.jpg',
      url: 'https://cdn.example.com/media/key.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 800,
      variantsJson: '{"640":{"url":"https://cdn.example.com/key-640w.webp"}}',
    });

    expect(prisma.media.create).toHaveBeenCalledWith({
      data: {
        storageKey: 'media/key.jpg',
        url: 'https://cdn.example.com/media/key.jpg',
        mimeType: 'image/jpeg',
        width: 1200,
        height: 800,
        variantsJson: '{"640":{"url":"https://cdn.example.com/key-640w.webp"}}',
      },
    });
    expect(result.id).toBe('media_1');
  });
});

describe('uploadAndCreateMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    putObject.mockResolvedValue('https://cdn.example.com/media/key.jpg');
    prisma.media.create.mockResolvedValue({
      id: 'media_1',
      storageKey: 'media/key.jpg',
      url: 'https://cdn.example.com/media/key.jpg',
      mimeType: 'image/jpeg',
      width: null,
      height: null,
      variantsJson: null,
      altText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('uploads and persists a media record', async () => {
    const result = await uploadAndCreateMedia(makeFile());
    expect(putObject).toHaveBeenCalledOnce();
    expect(prisma.media.create).toHaveBeenCalledOnce();
    expect(result.id).toBe('media_1');
  });
});

describe('getMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NOT_FOUND when media is missing', async () => {
    prisma.media.findUnique.mockResolvedValue(null);
    await expect(getMedia('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('deleteMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isStorageConfigured.mockReturnValue(true);
    deleteObject.mockResolvedValue(undefined);
  });

  it('deletes storage objects and the media row', async () => {
    prisma.media.findUnique.mockResolvedValue({
      id: 'media_1',
      storageKey: 'media/key.jpg',
      variantsJson: JSON.stringify({
        '640': { storageKey: 'media/key-640w.webp' },
      }),
    });
    prisma.media.delete.mockResolvedValue({});

    await deleteMedia('media_1');

    expect(deleteObject).toHaveBeenCalledWith('media/key.jpg');
    expect(deleteObject).toHaveBeenCalledWith('media/key-640w.webp');
    expect(prisma.media.delete).toHaveBeenCalledWith({
      where: { id: 'media_1' },
    });
  });
});

describe('deleteStoredObjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteObject.mockResolvedValue(undefined);
  });

  it('skips deletes when storage is not configured', async () => {
    isStorageConfigured.mockReturnValue(false);
    await deleteStoredObjects({ storageKey: 'media/key.jpg' });
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

describe('loadStorageStatus', () => {
  it('returns configured flag from client helper', () => {
    isStorageConfigured.mockReturnValue(true);
    expect(loadStorageStatus()).toEqual({ configured: true });
  });
});

describe('re-exports from client.server', () => {
  it('re-exports putObject, getObjectUrl, deleteObject, and isStorageConfigured', () => {
    expect(typeof putObject).toBe('function');
    expect(typeof getObjectUrl).toBe('function');
    expect(typeof deleteObject).toBe('function');
    expect(typeof isStorageConfigured).toBe('function');
  });
});
