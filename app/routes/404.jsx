import { useLoaderData } from 'react-router';

import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export function meta() {
  return [
    { title: '404 - Page Not Found' },
    {
      name: 'description',
      content: 'The page you are looking for does not exist.',
    },
  ];
}

/**
 * @param {{ request: Request }} args
 */
export async function loader({ request }) {
  const { themeId } = await loadStorefrontPageContext(request);
  return { themeId };
}

export default function NotFoundRoute() {
  const { themeId } = useLoaderData();
  const Layout = getStorefrontComponent('Layout', themeId);
  const NotFoundPage = getStorefrontComponent('NotFoundPage', themeId);

  if (!Layout || !NotFoundPage) {
    throw new Error('404 theme components not found');
  }

  // 404 wraps Layout itself — it sits outside the storefront layout route.
  return (
    <Layout>
      <NotFoundPage />
    </Layout>
  );
}
