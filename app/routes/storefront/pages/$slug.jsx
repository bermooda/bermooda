import { useLoaderData } from 'react-router';

import { JsonLd } from '#/components/seo/json-ld';

import { getPageBySlug } from '#/core/content/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import {
  buildBreadcrumbJsonLd,
  buildPageMeta,
  buildWebPageJsonLd,
} from '#/core/seo/index.server';
import PagePage from '#/themes/default/components/page-page';

export async function loader({ request, params }) {
  const locale = await getRequestLocale(request);
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
  const { page, jsonLd } = useLoaderData();

  return (
    <>
      <JsonLd data={jsonLd} />
      <PagePage page={page} />
    </>
  );
}
