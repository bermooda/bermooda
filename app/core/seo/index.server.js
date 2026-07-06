// app/core/seo/index.server.js
// SEO helpers: meta tags, canonical URLs, hreflang, JSON-LD, sitemap.

import { getDomainUrl } from '#/utils/misc';
import prisma from '#/libs/prisma.server';
import { listProducts } from '#/core/catalog/index.server';
import { listCollections } from '#/core/collections/index.server';
import { listPublishedPages } from '#/core/content/index.server';
import {
  DEFAULT_TITLE_TEMPLATE,
  normalizeTwitterHandle,
  resolveEntityMediaUrl,
  STATIC_SITEMAP_ROUTES,
  truncateMetaDescription,
} from '#/core/seo/input';
import {
  get as settingsGet,
  getMany as settingsGetMany,
} from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

export {
  DEFAULT_TITLE_TEMPLATE,
  normalizeTwitterHandle,
  resolveEntityMediaUrl,
  serializeJsonLd,
  STATIC_SITEMAP_ROUTES,
  truncateMetaDescription,
} from '#/core/seo/input';

const SEO_SETTING_KEYS = [
  SETTING_KEYS.SEO_META_TITLE,
  SETTING_KEYS.SEO_META_DESCRIPTION,
  SETTING_KEYS.SEO_OG_IMAGE_URL,
  SETTING_KEYS.SEO_TITLE_TEMPLATE,
  SETTING_KEYS.SEO_ALLOW_INDEXING,
  SETTING_KEYS.SEO_GOOGLE_SITE_VERIFICATION,
  SETTING_KEYS.SEO_BING_SITE_VERIFICATION,
  SETTING_KEYS.SEO_TWITTER_HANDLE,
  SETTING_KEYS.SHOP_NAME,
];

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
  const values = await settingsGetMany(SEO_SETTING_KEYS);

  return {
    metaTitle: values[SETTING_KEYS.SEO_META_TITLE] ?? '',
    metaDescription: values[SETTING_KEYS.SEO_META_DESCRIPTION] ?? '',
    ogImageUrl: values[SETTING_KEYS.SEO_OG_IMAGE_URL] ?? '',
    shopName: values[SETTING_KEYS.SHOP_NAME] ?? 'bermooda',
    titleTemplate:
      values[SETTING_KEYS.SEO_TITLE_TEMPLATE] ?? DEFAULT_TITLE_TEMPLATE,
    allowIndexing: values[SETTING_KEYS.SEO_ALLOW_INDEXING] !== false,
    googleSiteVerification:
      values[SETTING_KEYS.SEO_GOOGLE_SITE_VERIFICATION] ?? '',
    bingSiteVerification: values[SETTING_KEYS.SEO_BING_SITE_VERIFICATION] ?? '',
    twitterHandle: normalizeTwitterHandle(
      values[SETTING_KEYS.SEO_TWITTER_HANDLE]
    ),
  };
}

async function buildEntityMeta({
  entityType,
  entityId,
  pageTitle,
  description,
  image,
  type = 'website',
  request,
  path,
}) {
  const seo = await getSiteSeoSettings();
  const title = formatPageTitle(pageTitle, seo);
  const canonical = buildCanonicalUrl(request, path);
  const alternates = await buildAlternateLinks({
    entityType,
    entityId,
    request,
    path,
  });

  return buildMeta({
    title,
    description,
    canonical,
    alternates,
    image: image ?? (seo.ogImageUrl || null),
    type,
    robots: resolveRobotsMeta(seo),
    ...siteMetaExtras(seo),
  });
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
  const pageTitle = page.metaTitle || page.title || 'Page';
  const description = page.metaDescription || page.title || '';

  return buildEntityMeta({
    entityType: 'page',
    entityId: page.id,
    pageTitle,
    description,
    request,
    path,
  });
}

export async function buildProductMeta({ product, request, path }) {
  const pageTitle =
    product.metaTitle || product.seoTitle || product.title || 'Product';
  const description =
    product.metaDescription ||
    product.seoDescription ||
    truncateMetaDescription(product.description) ||
    pageTitle;

  return buildEntityMeta({
    entityType: 'product',
    entityId: product.id,
    pageTitle,
    description,
    image: resolveEntityMediaUrl(product),
    type: 'product',
    request,
    path,
  });
}

export async function buildCategoryMeta({ category, request, path }) {
  const pageTitle = category.metaTitle || category.title || 'Category';
  const description =
    category.metaDescription ||
    truncateMetaDescription(category.description) ||
    pageTitle;

  return buildEntityMeta({
    entityType: 'category',
    entityId: category.id,
    pageTitle,
    description,
    request,
    path,
  });
}

export async function buildCollectionMeta({ collection, request, path }) {
  const pageTitle = collection.title || collection.handle || 'Collection';
  const description =
    truncateMetaDescription(collection.description) || `Shop ${pageTitle}`;

  return buildEntityMeta({
    entityType: 'collection',
    entityId: collection.id,
    pageTitle,
    description,
    request,
    path,
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

/**
 * Build sitemap.xml body from catalog, CMS, and static routes.
 *
 * @returns {Promise<{ xml: string, allowIndexing: boolean }>}
 */
export async function buildSitemapXml({ request }) {
  const seo = await getSiteSeoSettings();
  if (!seo.allowIndexing) {
    return { xml: '', allowIndexing: false };
  }

  const baseUrl = buildCanonicalUrl(request, '/');
  const defaultLocale =
    (await settingsGet(SETTING_KEYS.DEFAULT_LOCALE)) ?? 'en';

  const [pages, { products }, { collections }, categorySlugs] =
    await Promise.all([
      listPublishedPages({ locale: defaultLocale }),
      listProducts({ locale: defaultLocale, published: true, limit: 10000 }),
      listCollections({
        publishedOnly: true,
        locale: defaultLocale,
        limit: 10000,
      }),
      prisma.slug.findMany({
        where: {
          entityType: 'category',
          locale: defaultLocale,
          canonical: true,
        },
        select: { slug: true },
      }),
    ]);

  const staticRoutes = [
    '',
    ...STATIC_SITEMAP_ROUTES.filter((route) => route !== ''),
  ];
  const today = new Date().toISOString().split('T')[0];

  const entries = [
    ...staticRoutes.map((route) => ({
      loc: route === '' ? baseUrl : `${baseUrl}/${route}`,
      lastmod: today,
      priority: route === '' ? '1.0' : '0.8',
    })),
    ...products
      .filter((product) => product.slug)
      .map((product) => ({
        loc: `${baseUrl}/products/${product.slug}`,
        lastmod: product.updatedAt?.toISOString?.().split('T')[0] ?? today,
        priority: '0.8',
      })),
    ...categorySlugs.map((category) => ({
      loc: `${baseUrl}/categories/${category.slug}`,
      lastmod: today,
      priority: '0.7',
    })),
    ...collections
      .filter((collection) => collection.handle)
      .map((collection) => ({
        loc: `${baseUrl}/collections/${collection.handle}`,
        lastmod: collection.updatedAt?.toISOString?.().split('T')[0] ?? today,
        priority: '0.7',
      })),
    ...pages
      .filter((page) => page.slug)
      .map((page) => ({
        loc: `${baseUrl}/${page.slug}`,
        lastmod: page.updatedAt?.toISOString?.().split('T')[0] ?? today,
        priority: '0.6',
      })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>
${entries
  .map(
    (entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return { xml, allowIndexing: true };
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
    variant?.prices?.find((price) => price.currency === currency) ??
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

  const imageUrl = resolveEntityMediaUrl(product);
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
