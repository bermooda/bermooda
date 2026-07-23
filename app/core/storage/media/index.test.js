// app/core/storage/media/index.test.js

import { describe, expect, it } from 'vitest';

import {
  collectStorageKeys,
  parseMediaVariants,
  pickMediaRecord,
  resolveCatalogMediaUrl,
  resolveMediaUrl,
  serializeMediaRecord,
} from '#/core/storage/media';

describe('parseMediaVariants', () => {
  it('returns an empty object for missing input', () => {
    expect(parseMediaVariants(null)).toEqual({});
    expect(parseMediaVariants('')).toEqual({});
  });

  it('parses valid JSON', () => {
    expect(
      parseMediaVariants(
        JSON.stringify({
          '640': { url: 'https://cdn.example.com/media/key-640w.webp' },
        })
      )
    ).toEqual({
      '640': { url: 'https://cdn.example.com/media/key-640w.webp' },
    });
  });

  it('returns an empty object for invalid JSON', () => {
    expect(parseMediaVariants('{bad json')).toEqual({});
  });
});

describe('resolveMediaUrl', () => {
  it('returns the original URL when no variants exist', () => {
    expect(
      resolveMediaUrl({ url: 'https://cdn.example.com/media/key.jpg' })
    ).toBe('https://cdn.example.com/media/key.jpg');
  });

  it('returns the smallest variant at or above the target width', () => {
    const media = {
      url: 'https://cdn.example.com/media/key.jpg',
      variantsJson: JSON.stringify({
        '640': { url: 'https://cdn.example.com/media/key-640w.webp' },
        '1280': { url: 'https://cdn.example.com/media/key-1280w.webp' },
      }),
    };

    expect(resolveMediaUrl(media, 640)).toBe(
      'https://cdn.example.com/media/key-640w.webp'
    );
    expect(resolveMediaUrl(media, 900)).toBe(
      'https://cdn.example.com/media/key-1280w.webp'
    );
  });
});

describe('pickMediaRecord', () => {
  it('normalizes nested catalog media shapes', () => {
    expect(
      pickMediaRecord({
        media: [{ media: { url: 'https://cdn.example.com/a.jpg' } }],
      })
    ).toEqual({ url: 'https://cdn.example.com/a.jpg' });

    expect(
      pickMediaRecord({ media: { url: 'https://cdn.example.com/b.jpg' } })
    ).toEqual({ url: 'https://cdn.example.com/b.jpg' });

    expect(pickMediaRecord({ url: 'https://cdn.example.com/c.jpg' })).toEqual({
      url: 'https://cdn.example.com/c.jpg',
    });
  });
});

describe('resolveCatalogMediaUrl', () => {
  it('returns null when no media is present', () => {
    expect(resolveCatalogMediaUrl(null)).toBeNull();
    expect(resolveCatalogMediaUrl({})).toBeNull();
  });

  it('resolves responsive URLs from catalog entities', () => {
    expect(
      resolveCatalogMediaUrl(
        {
          media: [
            {
              media: {
                url: 'https://cdn.example.com/media/key.jpg',
                variantsJson: JSON.stringify({
                  '640': {
                    url: 'https://cdn.example.com/media/key-640w.webp',
                  },
                }),
              },
            },
          ],
        },
        640
      )
    ).toBe('https://cdn.example.com/media/key-640w.webp');
  });
});

describe('serializeMediaRecord', () => {
  it('maps database fields to API shape', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    expect(
      serializeMediaRecord({
        id: 'media_1',
        storageKey: 'media/key.jpg',
        url: 'https://cdn.example.com/media/key.jpg',
        mimeType: 'image/jpeg',
        width: 1200,
        height: 800,
        variantsJson: null,
        altText: 'Hero',
        createdAt,
        updatedAt,
      })
    ).toEqual({
      id: 'media_1',
      storageKey: 'media/key.jpg',
      url: 'https://cdn.example.com/media/key.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 800,
      variantsJson: null,
      altText: 'Hero',
      createdAt,
      updatedAt,
    });
  });
});

describe('collectStorageKeys', () => {
  it('includes the primary key and responsive variant keys', () => {
    expect(
      collectStorageKeys({
        storageKey: 'media/key.jpg',
        variantsJson: JSON.stringify({
          '640': { storageKey: 'media/key-640w.webp' },
          '1280': { storageKey: 'media/key-1280w.webp' },
        }),
      })
    ).toEqual(['media/key.jpg', 'media/key-640w.webp', 'media/key-1280w.webp']);
  });
});
