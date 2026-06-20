// app/core/seo/index.server.js
// SEO helpers: meta tags, canonical URLs, hreflang, JSON-LD.

import { getDomainUrl } from '#/utils/misc';
import prisma from '#/libs/prisma.server';

import { get as settingsGet } from '#/core/settings/index.server';

/**
 * Build absolute URL for a path on this site.
 */
export function buildCanonicalUrl(request, path = '/') {
  const base = getDomainUrl(request);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized === '/' ? '' : normalized}`;
}

/**
 * hreflang alternates share the same URL path (cookie-based locale).
 * Full locale-prefixed URLs are deferred to W8/W9.
 */
export async function buildAlternateLinks({
  entityType,
  entityId,
  request,
  path,
}) {
  const slugRows = await prisma.slug.findMany({
    where: { entityType, entityId },
  });
  if (!slugRows.length) return [];

  const canonicalUrl = buildCanonicalUrl(request, path);
  const locales = [...new Set(slugRows.map((row) => row.locale))];

  return locales.map((locale) => ({
    tagName: 'link',
    rel: 'alternate',
    hrefLang: locale,
    href: canonicalUrl,
  }));
}

export function buildMeta({
  title,
  description,
  canonical,
  alternates = [],
  robots,
}) {
  const tags = [{ title }];
  if (description) {
    tags.push({ name: 'description', content: description });
  }
  if (canonical) {
    tags.push({ tagName: 'link', rel: 'canonical', href: canonical });
  }
  if (robots) {
    tags.push({ name: 'robots', content: robots });
  }
  return [...tags, ...alternates];
}

export async function buildPageMeta({ page, request, path }) {
  const title = page.metaTitle || page.title || 'Page';
  const description = page.metaDescription || page.title || '';
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType: 'page',
    entityId: page.id,
    request,
    path,
  });
  return buildMeta({ title, description, canonical, alternates });
}

export async function buildProductMeta({ product, request, path }) {
  const title =
    product.metaTitle || product.seoTitle || product.title || 'Product';
  const description =
    product.metaDescription ||
    product.seoDescription ||
    product.description?.slice(0, 160) ||
    title;
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType: 'product',
    entityId: product.id,
    request,
    path,
  });
  return buildMeta({ title, description, canonical, alternates });
}

export async function buildCategoryMeta({ category, request, path }) {
  const title = category.metaTitle || category.title || 'Category';
  const description =
    category.metaDescription || category.description?.slice(0, 160) || title;
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType: 'category',
    entityId: category.id,
    request,
    path,
  });
  return buildMeta({ title, description, canonical, alternates });
}

export function buildBreadcrumbJsonLd(items, request) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': item.name,
      'item': item.url ? buildCanonicalUrl(request, item.url) : undefined,
    })),
  };
}

export async function buildOrganizationJsonLd(request) {
  const shopName = (await settingsGet('shopName')) ?? 'bermooda';
  const url = buildCanonicalUrl(request, '/');

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': shopName,
    url,
  };
}

export function buildWebSiteJsonLd(request) {
  const url = buildCanonicalUrl(request, '/');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'bermooda',
    url,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildProductJsonLd(
  product,
  { locale, currency, request, reviewSummary }
) {
  const variant = product.variants?.[0];
  const priceEntry =
    variant?.prices?.find((p) => p.currency === currency) ??
    variant?.prices?.[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.title,
    'description': product.description,
    'url': buildCanonicalUrl(request, `/products/${product.slug}`),
    'offers': priceEntry
      ? {
          '@type': 'Offer',
          'priceCurrency': priceEntry.currency,
          'price': (priceEntry.priceCents / 100).toFixed(2),
          'availability':
            variant?.inventoryTracked && variant.inventoryCount <= 0
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
        }
      : undefined,
  };

  const imageUrl =
    product.media?.[0]?.media?.url ?? product.media?.[0]?.url ?? null;
  if (imageUrl) jsonLd.image = imageUrl;

  if (reviewSummary?.count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      'ratingValue': reviewSummary.averageRating,
      'reviewCount': reviewSummary.count,
    };
  }

  return jsonLd;
}

export function buildWebPageJsonLd(page, { request, path }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': page.title,
    'description': page.metaDescription || page.title,
    'url': buildCanonicalUrl(request, path),
  };
}

export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
