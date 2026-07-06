// app/core/seo/index.test.server.js

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('#/libs/prisma.server', () => ({
  default: {
    slug: { findMany: vi.fn() },
  },
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
  getMany: vi.fn(),
}));

vi.mock('#/core/catalog/index.server', () => ({
  listProducts: vi.fn(),
}));

vi.mock('#/core/collections/index.server', () => ({
  listCollections: vi.fn(),
}));

vi.mock('#/core/content/index.server', () => ({
  listPublishedPages: vi.fn(),
}));

import prisma from '#/libs/prisma.server';
import { listProducts } from '#/core/catalog/index.server';
import { listCollections } from '#/core/collections/index.server';
import { listPublishedPages } from '#/core/content/index.server';
import {
  buildCanonicalUrl,
  buildProductJsonLd,
  buildMeta,
  buildRobotsTxt,
  buildSiteMeta,
  buildSitemapXml,
  formatPageTitle,
  normalizeTwitterHandle,
  resolveRobotsMeta,
} from '#/core/seo/index.server';
import { serializeJsonLd } from '#/core/seo/input';
import {
  get as settingsGet,
  getMany as settingsGetMany,
} from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

const request = new Request('https://shop.example/products/foo');

function mockSeoSettings(overrides = {}) {
  settingsGetMany.mockResolvedValue({
    [SETTING_KEYS.SEO_META_TITLE]: overrides.metaTitle ?? null,
    [SETTING_KEYS.SEO_META_DESCRIPTION]: overrides.metaDescription ?? null,
    [SETTING_KEYS.SEO_OG_IMAGE_URL]: overrides.ogImageUrl ?? null,
    [SETTING_KEYS.SEO_TITLE_TEMPLATE]: overrides.titleTemplate ?? null,
    [SETTING_KEYS.SEO_ALLOW_INDEXING]: overrides.allowIndexing ?? null,
    [SETTING_KEYS.SEO_GOOGLE_SITE_VERIFICATION]:
      overrides.googleSiteVerification ?? null,
    [SETTING_KEYS.SEO_BING_SITE_VERIFICATION]:
      overrides.bingSiteVerification ?? null,
    [SETTING_KEYS.SEO_TWITTER_HANDLE]: overrides.twitterHandle ?? null,
    [SETTING_KEYS.SHOP_NAME]: overrides.shopName ?? 'My Shop',
  });
}

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
    mockSeoSettings({ allowIndexing: false });

    const body = await buildRobotsTxt(request);

    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
  });

  it('includes sitemap and storefront disallow rules when indexing is enabled', async () => {
    mockSeoSettings({ allowIndexing: true });

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
    mockSeoSettings({
      metaTitle: 'My Shop',
      metaDescription: 'Best products online',
      ogImageUrl: 'https://cdn.example/og.jpg',
      allowIndexing: true,
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

describe('buildSitemapXml', () => {
  it('returns empty output when indexing is disabled', async () => {
    mockSeoSettings({ allowIndexing: false });

    const result = await buildSitemapXml({ request });

    expect(result.allowIndexing).toBe(false);
    expect(result.xml).toBe('');
    expect(listProducts).not.toHaveBeenCalled();
  });

  it('includes products, categories, collections, and CMS pages', async () => {
    mockSeoSettings({ allowIndexing: true });
    settingsGet.mockResolvedValue('en');
    listPublishedPages.mockResolvedValue([
      { slug: 'about', updatedAt: new Date('2026-01-02') },
    ]);
    listProducts.mockResolvedValue({
      products: [
        {
          slug: 'mug',
          updatedAt: new Date('2026-01-03'),
        },
      ],
    });
    listCollections.mockResolvedValue({
      collections: [
        {
          handle: 'summer',
          updatedAt: new Date('2026-01-04'),
        },
      ],
    });
    prisma.slug.findMany.mockResolvedValue([{ slug: 'drinkware' }]);

    const result = await buildSitemapXml({ request });

    expect(result.allowIndexing).toBe(true);
    expect(result.xml).toContain('http://shop.example/products/mug');
    expect(result.xml).toContain('http://shop.example/categories/drinkware');
    expect(result.xml).toContain('http://shop.example/collections/summer');
    expect(result.xml).toContain('http://shop.example/about');
  });
});
