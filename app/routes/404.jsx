import { useLoaderData } from 'react-router';

import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components/index';

export function meta() {
  return [
    { title: '404 - Page Not Found' },
    {
      name: 'description',
      content: 'The page you are looking for does not exist.',
    },
  ];
}

export async function loader() {
  const themeId = await preloadStorefrontTheme();
  return { themeId };
}

export default function NotFoundRoute() {
  const { themeId } = useLoaderData();
  const Layout = getStorefrontComponent('Layout', themeId);
  const NotFoundPage = getStorefrontComponent('NotFoundPage', themeId);

  if (!Layout || !NotFoundPage) {
    throw new Error('404 theme components not found');
  }

  return (
    <Layout>
      <NotFoundPage />
    </Layout>
  );
}
