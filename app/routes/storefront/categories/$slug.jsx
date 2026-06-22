import { useLoaderData } from 'react-router';

import { JsonLd } from '#/components/seo/json-ld';

import { getCategoryBySlug, listProducts } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import { attachReviewSummaries } from '#/core/reviews/index.server';
import {
  buildBreadcrumbJsonLd,
  buildCategoryMeta,
} from '#/core/seo/index.server';
import CategoryPage from '#/themes/default/components/category-page';

export async function loader({ request, params }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);
  const category = await getCategoryBySlug(params.slug, { locale });

  if (!category) {
    throw new Response('Category not found', { status: 404 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 1);
  const { products: rawProducts, total } = await listProducts({
    locale,
    currency,
    categoryId: category.id,
    page,
    limit: 24,
    published: true,
  });

  const products = await attachReviewSummaries(rawProducts);
  const path = `/categories/${params.slug}`;
  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'Home', url: '/' },
      { name: category.title, url: path },
    ],
    request
  );

  return {
    category,
    products,
    total,
    page,
    locale,
    currency,
    path,
    jsonLd: breadcrumb,
    metaTags: await buildCategoryMeta({ category, request, path }),
  };
}

export function meta({ loaderData }) {
  if (!loaderData?.metaTags) return [{ title: 'Category not found' }];
  return loaderData.metaTags;
}

export default function CategoryRoute() {
  const data = useLoaderData();
  return (
    <>
      <JsonLd data={data.jsonLd} />
      <CategoryPage {...data} />
    </>
  );
}
