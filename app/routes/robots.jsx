import { buildRobotsTxt } from '#/core/seo/index.server';

/**
 * Serve robots.txt with crawl rules and sitemap reference.
 */
export async function loader({ request }) {
  const body = await buildRobotsTxt(request);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
