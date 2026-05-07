import { useLoaderData } from 'react-router';

import { listProducts, listCategories } from '#/core/catalog/index.server';
import { getRequestCurrency } from '#/core/currency/index.server';
import { getRequestLocale } from '#/core/i18n/index.server';
import HomePage from '#/themes/default/components/home-page';

export async function loader({ request }) {
  const locale = await getRequestLocale(request);
  const currency = await getRequestCurrency(request);

  const [{ products }, categories] = await Promise.all([
    listProducts({ locale, currency, limit: 12, published: true }),
    listCategories({ locale }),
  ]);

  return { products, categories, locale, currency };
}

export function meta() {
  return [
    { title: 'bermooda' },
    { name: 'description', content: 'Welcome to bermooda' },
  ];
}

export default function StorefrontIndexRoute() {
  const data = useLoaderData();
  return <HomePage {...data} />;
}
