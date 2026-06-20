import { getDomainUrl } from '#/utils/misc';
import prisma from '#/libs/prisma.server';

import { listProducts } from '#/core/catalog/index.server';
import { listPublishedPages } from '#/core/content/index.server';
import { get as settingsGet } from '#/core/settings/index.server';
import { INDEXED_ROUTES } from '#/routes';

/**
 * Generate a dynamic sitemap XML from static routes + catalog + CMS pages.
 */
export async function loader({ request }) {
  const baseUrl = getDomainUrl(request);
  const defaultLocale = (await settingsGet('defaultLocale')) ?? 'en';

  const [pages, { products }, categorySlugs] = await Promise.all([
    listPublishedPages({ locale: defaultLocale }),
    listProducts({ locale: defaultLocale, published: true, limit: 10000 }),
    prisma.slug.findMany({
      where: { entityType: 'category', locale: defaultLocale, canonical: true },
      select: { slug: true },
    }),
  ]);

  const staticRoutes = ['', ...INDEXED_ROUTES.filter((r) => r !== '')];
  const today = new Date().toISOString().split('T')[0];

  const entries = [
    ...staticRoutes.map((route) => ({
      loc: route === '' ? baseUrl : `${baseUrl}/${route}`,
      lastmod: today,
      priority: route === '' ? '1.0' : '0.8',
    })),
    ...products
      .filter((p) => p.slug)
      .map((p) => ({
        loc: `${baseUrl}/products/${p.slug}`,
        lastmod: p.updatedAt?.toISOString?.().split('T')[0] ?? today,
        priority: '0.8',
      })),
    ...categorySlugs.map((c) => ({
      loc: `${baseUrl}/categories/${c.slug}`,
      lastmod: today,
      priority: '0.7',
    })),
    ...pages
      .filter((p) => p.slug)
      .map((p) => ({
        loc: `${baseUrl}/${p.slug}`,
        lastmod: p.updatedAt?.toISOString?.().split('T')[0] ?? today,
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

  const bytes = new TextEncoder().encode(xml).byteLength;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Length': String(bytes),
      'Cache-Control': 'public, max-age=300',
    },
  });
}
