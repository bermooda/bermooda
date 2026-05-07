import { useLoaderData } from 'react-router';

import { getCategoryBySlug, listProducts } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
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
  const { products, total } = await listProducts({
    locale,
    currency,
    categoryId: category.id,
    page,
    limit: 24,
    published: true,
  });

  return { category, products, total, page, locale, currency };
}

export function meta({ data }) {
  const title = data?.category?.title ?? 'Category';
  return [{ title }, { name: 'description', content: title }];
}

export default function CategoryRoute() {
  const data = useLoaderData();
  return <CategoryPage {...data} />;
}
