import { useLoaderData } from 'react-router';

import { getPageBySlug } from '#/core/content/index.server';
import {
  buildBreadcrumbJsonLd,
  buildPageMeta,
  buildWebPageJsonLd,
} from '#/core/seo/index.server';
import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';
import { JsonLd } from '#/components/seo/json-ld';

export async function loader({ request, params }) {
  const { themeId, locale } = await loadStorefrontPageContext(request);
  const page = await getPageBySlug(params.slug, {
    locale,
    requirePublished: true,
  });

  if (!page) {
    throw new Response('Page not found', { status: 404 });
  }

  const path = `/${params.slug}`;
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'Home', url: '/' },
      { name: page.title, url: path },
    ],
    request
  );
  const webPage = buildWebPageJsonLd(page, { request, path });

  return {
    themeId,
    page,
    locale,
    path,
    jsonLd: [breadcrumb, webPage],
    metaTags: await buildPageMeta({ page, request, path }),
  };
}

export function meta({ loaderData }) {
  if (!loaderData?.metaTags) return [{ title: 'Page not found' }];
  return loaderData.metaTags;
}

export default function StorefrontPageRoute() {
  const { page, jsonLd, themeId } = useLoaderData();
  const PagePage = getStorefrontComponent('PagePage', themeId);
  if (!PagePage) throw new Error('PagePage theme component not found');

  return (
    <>
      <JsonLd data={jsonLd} />
      <PagePage page={page} />
    </>
  );
}
