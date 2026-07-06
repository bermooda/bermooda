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
  image,
  type = 'website',
  twitterHandle,
  googleSiteVerification,
  bingSiteVerification,
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

  tags.push({ property: 'og:title', content: title });
  if (description) {
    tags.push({ property: 'og:description', content: description });
  }
  if (canonical) {
    tags.push({ property: 'og:url', content: canonical });
  }
  tags.push({ property: 'og:type', content: type });
  if (image) {
    tags.push({ property: 'og:image', content: image });
    tags.push({ name: 'twitter:card', content: 'summary_large_image' });
    tags.push({ name: 'twitter:title', content: title });
    if (description) {
      tags.push({ name: 'twitter:description', content: description });
    }
    tags.push({ name: 'twitter:image', content: image });
  }

  const normalizedTwitter = normalizeTwitterHandle(twitterHandle);
  if (normalizedTwitter) {
    tags.push({ name: 'twitter:site', content: `@${normalizedTwitter}` });
  }

  if (googleSiteVerification) {
    tags.push({
      name: 'google-site-verification',
      content: googleSiteVerification,
    });
  }
  if (bingSiteVerification) {
    tags.push({ name: 'msvalidate.01', content: bingSiteVerification });
  }

  return [...tags, ...alternates];
}

const DEFAULT_TITLE_TEMPLATE = '{pageTitle} | {shopName}';

/**
 * Strip a leading @ from a Twitter/X handle.
 *
 * @param {string|null|undefined} handle
 * @returns {string}
 */
export function normalizeTwitterHandle(handle) {
  const trimmed = String(handle ?? '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/^@+/, '');
}

/**
 * Apply the shop title template to a page title.
 *
 * @param {string} pageTitle
 * @param {{ metaTitle?: string, shopName?: string, titleTemplate?: string }} seo
 * @param {{ isHomepage?: boolean }} [options]
 * @returns {string}
 */
export function formatPageTitle(pageTitle, seo, { isHomepage = false } = {}) {
  if (isHomepage) {
    return seo.metaTitle || seo.shopName || pageTitle;
  }

  const template = seo.titleTemplate?.trim() || DEFAULT_TITLE_TEMPLATE;
  if (!template.includes('{pageTitle}')) {
    return pageTitle;
  }

  return template
    .replaceAll('{pageTitle}', pageTitle)
    .replaceAll('{shopName}', seo.shopName || 'bermooda');
}

/**
 * Resolve robots meta content from site settings and optional page override.
 *
 * @param {{ allowIndexing?: boolean }} seo
 * @param {string|undefined} robotsOverride
 * @returns {string|undefined}
 */
export function resolveRobotsMeta(seo, robotsOverride) {
  if (robotsOverride) return robotsOverride;
  if (seo.allowIndexing === false) return 'noindex, nofollow';
  return undefined;
}

/**
 * @param {Awaited<ReturnType<typeof getSiteSeoSettings>>} seo
 */
function siteMetaExtras(seo) {
  return {
    twitterHandle: seo.twitterHandle,
    googleSiteVerification: seo.googleSiteVerification || undefined,
    bingSiteVerification: seo.bingSiteVerification || undefined,
  };
}

/**
 * Load shop-level SEO settings used as defaults for the storefront.
 */
export async function getSiteSeoSettings() {
  const [
    metaTitle,
    metaDescription,
    ogImageUrl,
    shopName,
    titleTemplate,
    allowIndexing,
    googleSiteVerification,
    bingSiteVerification,
    twitterHandle,
  ] = await Promise.all([
    settingsGet('seo.metaTitle'),
    settingsGet('seo.metaDescription'),
    settingsGet('seo.ogImageUrl'),
    settingsGet('shopName'),
    settingsGet('seo.titleTemplate'),
    settingsGet('seo.allowIndexing'),
    settingsGet('seo.googleSiteVerification'),
    settingsGet('seo.bingSiteVerification'),
    settingsGet('seo.twitterHandle'),
  ]);

  return {
    metaTitle: metaTitle ?? '',
    metaDescription: metaDescription ?? '',
    ogImageUrl: ogImageUrl ?? '',
    shopName: shopName ?? 'bermooda',
    titleTemplate: titleTemplate ?? DEFAULT_TITLE_TEMPLATE,
    allowIndexing: allowIndexing !== false,
    googleSiteVerification: googleSiteVerification ?? '',
    bingSiteVerification: bingSiteVerification ?? '',
    twitterHandle: normalizeTwitterHandle(twitterHandle),
  };
}

/**
 * Build meta tags for the storefront homepage using shop SEO settings.
 */
export async function buildSiteMeta({ request, path = '/' }) {
  const seo = await getSiteSeoSettings();
  const title = formatPageTitle(seo.shopName, seo, { isHomepage: true });
  const description = seo.metaDescription || `Welcome to ${seo.shopName}`;
  const canonical = buildCanonicalUrl(request, path);

  return buildMeta({
    title,
    description,
    canonical,
    image: seo.ogImageUrl || null,
    robots: resolveRobotsMeta(seo),
    ...siteMetaExtras(seo),
  });
}

export async function buildPageMeta({ page, request, path }) {
  const seo = await getSiteSeoSettings();
  const pageTitle = page.metaTitle || page.title || 'Page';
  const title = formatPageTitle(pageTitle, seo);
  const description = page.metaDescription || page.title || '';
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType: 'page',
    entityId: page.id,
    request,
    path,
  });
  const image = seo.ogImageUrl || null;

  return buildMeta({
    title,
    description,
    canonical,
    alternates,
    image,
    robots: resolveRobotsMeta(seo),
    ...siteMetaExtras(seo),
  });
}

export async function buildProductMeta({ product, request, path }) {
  const seo = await getSiteSeoSettings();
  const pageTitle =
    product.metaTitle || product.seoTitle || product.title || 'Product';
  const title = formatPageTitle(pageTitle, seo);
  const description =
    product.metaDescription ||
    product.seoDescription ||
    product.description?.slice(0, 160) ||
    pageTitle;
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType: 'product',
    entityId: product.id,
    request,
    path,
  });
  const image =
    product.media?.[0]?.media?.url ??
    product.media?.[0]?.url ??
    (seo.ogImageUrl || null);

  return buildMeta({
    title,
    description,
    canonical,
    alternates,
    image,
    type: 'product',
    robots: resolveRobotsMeta(seo),
    ...siteMetaExtras(seo),
  });
}

export async function buildCategoryMeta({ category, request, path }) {
  const seo = await getSiteSeoSettings();
  const pageTitle = category.metaTitle || category.title || 'Category';
  const title = formatPageTitle(pageTitle, seo);
  const description =
    category.metaDescription ||
    category.description?.slice(0, 160) ||
    pageTitle;
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType: 'category',
    entityId: category.id,
    request,
    path,
  });
  const image = seo.ogImageUrl || null;

  return buildMeta({
    title,
    description,
    canonical,
    alternates,
    image,
    robots: resolveRobotsMeta(seo),
    ...siteMetaExtras(seo),
  });
}

export async function buildCollectionMeta({ collection, request, path }) {
  const seo = await getSiteSeoSettings();
  const pageTitle = collection.title || collection.handle || 'Collection';
  const title = formatPageTitle(pageTitle, seo);
  const description =
    collection.description?.slice(0, 160) || `Shop ${pageTitle}`;
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType: 'collection',
    entityId: collection.id,
    request,
    path,
  });
  const image = seo.ogImageUrl || null;

  return buildMeta({
    title,
    description,
    canonical,
    alternates,
    image,
    robots: resolveRobotsMeta(seo),
    ...siteMetaExtras(seo),
  });
}

/**
 * Generate robots.txt body for the storefront.
 */
export async function buildRobotsTxt(request) {
  const seo = await getSiteSeoSettings();
  const sitemapUrl = `${buildCanonicalUrl(request, '/')}/sitemap.xml`;

  if (!seo.allowIndexing) {
    return ['User-agent: *', 'Disallow: /', ''].join('\n');
  }

  return [
    'User-agent: *',
    'Allow: /',
    '',
    'Disallow: /admin',
    'Disallow: /account',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /api/',
    'Disallow: /health',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n');
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
  const seo = await getSiteSeoSettings();
  const url = buildCanonicalUrl(request, '/');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': seo.shopName,
    url,
  };

  if (seo.ogImageUrl) {
    jsonLd.logo = seo.ogImageUrl;
  }

  return jsonLd;
}

export async function buildWebSiteJsonLd(request) {
  const seo = await getSiteSeoSettings();
  const url = buildCanonicalUrl(request, '/');
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': seo.metaTitle || seo.shopName,
    'description': seo.metaDescription || undefined,
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
  { locale: _locale, currency, request, reviewSummary }
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
