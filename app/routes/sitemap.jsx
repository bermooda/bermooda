import { getDomainUrl } from '#/utils/misc';

import { INDEXED_ROUTES } from '#/routes';

/**
 * Generate a sitemap XML from the application routes
 */
export async function loader({ request }) {
  const baseUrl = getDomainUrl(request);
  const sitemapRoutes = ['', ...INDEXED_ROUTES];

  // Generate XML content
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
>
${sitemapRoutes
  .map((route) => {
    const url = route === '' ? baseUrl : `${baseUrl}/${route}`;
    return `  <url>
    <loc>${url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${route === '' ? '1.0' : '0.8'}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;

  // Get the byte length of the XML content
  const bytes = new TextEncoder().encode(xml).byteLength;

  // Return XML response
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Length': String(bytes),
      'Cache-Control': `public, max-age=300`,
    },
  });
}
