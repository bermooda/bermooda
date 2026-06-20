// app/core/seo/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    slug: { findMany: vi.fn() },
  },
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
}));

import prisma from '#/libs/prisma.server';

import {
  buildCanonicalUrl,
  buildProductJsonLd,
  buildMeta,
  serializeJsonLd,
} from '#/core/seo/index.server';
import { get } from '#/core/settings/index.server';

const request = new Request('https://shop.example/products/foo');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildCanonicalUrl', () => {
  it('builds absolute URL from request', () => {
    expect(buildCanonicalUrl(request, '/about')).toBe(
      'http://shop.example/about'
    );
  });
});

describe('buildMeta', () => {
  it('returns title, description, canonical, and alternates', () => {
    const tags = buildMeta({
      title: 'About',
      description: 'About us',
      canonical: 'https://shop.example/about',
      alternates: [
        {
          tagName: 'link',
          rel: 'alternate',
          hrefLang: 'en',
          href: 'https://shop.example/about',
        },
      ],
    });

    expect(tags[0]).toEqual({ title: 'About' });
    expect(tags.some((t) => t.rel === 'canonical')).toBe(true);
    expect(tags.some((t) => t.hrefLang === 'en')).toBe(true);
  });
});

describe('buildProductJsonLd', () => {
  it('includes Product, Offer, and AggregateRating when reviews exist', () => {
    const jsonLd = buildProductJsonLd(
      {
        id: 'p1',
        title: 'Mug',
        slug: 'mug',
        description: 'A nice mug',
        variants: [
          {
            inventoryTracked: true,
            inventoryCount: 5,
            prices: [{ currency: 'USD', priceCents: 1999 }],
          },
        ],
        media: [{ media: { url: 'https://cdn.example/mug.jpg' } }],
      },
      {
        locale: 'en',
        currency: 'USD',
        request,
        reviewSummary: { averageRating: 4.8, count: 12 },
      }
    );

    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.offers.price).toBe('19.99');
    expect(jsonLd.aggregateRating.reviewCount).toBe(12);
  });
});

describe('serializeJsonLd', () => {
  it('escapes angle brackets', () => {
    expect(serializeJsonLd({ x: '<script>' })).not.toContain('<script>');
  });
});

describe('buildAlternateLinks', () => {
  it('returns hreflang links for each locale slug row', async () => {
    const { buildAlternateLinks } = await import('#/core/seo/index.server');
    prisma.slug.findMany.mockResolvedValue([
      { locale: 'en' },
      { locale: 'de' },
    ]);

    const links = await buildAlternateLinks({
      entityType: 'page',
      entityId: 'page_1',
      request,
      path: '/about',
    });

    expect(links).toHaveLength(2);
    expect(links[0].hrefLang).toBe('en');
  });
});
