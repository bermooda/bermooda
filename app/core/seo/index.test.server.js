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
  buildRobotsTxt,
  buildSiteMeta,
  formatPageTitle,
  normalizeTwitterHandle,
  resolveRobotsMeta,
  serializeJsonLd,
} from '#/core/seo/index.server';
import { get as settingsGet } from '#/core/settings/index.server';

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
    expect(tags.some((t) => t.property === 'og:title')).toBe(true);
  });

  it('includes Open Graph and Twitter tags when image is provided', () => {
    const tags = buildMeta({
      title: 'Home',
      description: 'Welcome',
      canonical: 'https://shop.example/',
      image: 'https://cdn.example/hero.jpg',
    });

    expect(tags.some((t) => t.property === 'og:image')).toBe(true);
    expect(tags.some((t) => t.name === 'twitter:card')).toBe(true);
    expect(tags.find((t) => t.property === 'og:image')?.content).toBe(
      'https://cdn.example/hero.jpg'
    );
  });

  it('includes verification and twitter:site tags when configured', () => {
    const tags = buildMeta({
      title: 'Home',
      twitterHandle: '@myshop',
      googleSiteVerification: 'google-token',
      bingSiteVerification: 'bing-token',
    });

    expect(tags.find((t) => t.name === 'twitter:site')?.content).toBe(
      '@myshop'
    );
    expect(
      tags.find((t) => t.name === 'google-site-verification')?.content
    ).toBe('google-token');
    expect(tags.find((t) => t.name === 'msvalidate.01')?.content).toBe(
      'bing-token'
    );
  });
});

describe('formatPageTitle', () => {
  const seo = {
    metaTitle: 'My Shop',
    shopName: 'My Shop',
    titleTemplate: '{pageTitle} | {shopName}',
  };

  it('uses meta title on the homepage', () => {
    expect(formatPageTitle('Ignored', seo, { isHomepage: true })).toBe(
      'My Shop'
    );
  });

  it('applies the title template on inner pages', () => {
    expect(formatPageTitle('Blue Mug', seo)).toBe('Blue Mug | My Shop');
  });
});

describe('resolveRobotsMeta', () => {
  it('prefers explicit page robots directives', () => {
    expect(resolveRobotsMeta({ allowIndexing: true }, 'noindex')).toBe(
      'noindex'
    );
  });

  it('blocks indexing when allowIndexing is false', () => {
    expect(resolveRobotsMeta({ allowIndexing: false })).toBe(
      'noindex, nofollow'
    );
  });
});

describe('normalizeTwitterHandle', () => {
  it('strips leading @ characters', () => {
    expect(normalizeTwitterHandle('@myshop')).toBe('myshop');
  });
});

describe('buildRobotsTxt', () => {
  it('disallows all crawlers when indexing is disabled', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'seo.allowIndexing') return false;
      if (key === 'shopName') return 'My Shop';
      return null;
    });

    const body = await buildRobotsTxt(request);

    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
  });

  it('includes sitemap and storefront disallow rules when indexing is enabled', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'seo.allowIndexing') return true;
      if (key === 'shopName') return 'My Shop';
      return null;
    });

    const body = await buildRobotsTxt(request);

    expect(body).toContain('Sitemap: http://shop.example/sitemap.xml');
    expect(body).toContain('Disallow: /admin');
    expect(body).toContain('Disallow: /checkout');
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

describe('buildSiteMeta', () => {
  it('uses shop SEO settings with fallbacks', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key === 'seo.metaTitle') return 'My Shop';
      if (key === 'seo.metaDescription') return 'Best products online';
      if (key === 'seo.ogImageUrl') return 'https://cdn.example/og.jpg';
      if (key === 'seo.allowIndexing') return true;
      if (key === 'shopName') return 'Fallback Shop';
      return null;
    });

    const tags = await buildSiteMeta({ request, path: '/' });

    expect(tags[0]).toEqual({ title: 'My Shop' });
    expect(tags.some((t) => t.name === 'description')).toBe(true);
    expect(tags.find((t) => t.property === 'og:image')?.content).toBe(
      'https://cdn.example/og.jpg'
    );
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
