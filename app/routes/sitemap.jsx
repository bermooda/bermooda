import { buildSitemapXml } from '#/core/seo/index.server';

/**
 * Serve sitemap.xml with catalog, CMS, and static routes.
 */
export async function loader({ request }) {
  const { xml, allowIndexing } = await buildSitemapXml({ request });

  if (!allowIndexing) {
    return new Response('Not found', { status: 404 });
  }

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
