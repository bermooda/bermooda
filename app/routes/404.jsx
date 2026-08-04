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
  const { themeId, ...data } = await loadStorefrontPageContext(request);
  return { themeId, ...data };
}

/**
 * Renders the theme `NotFoundPage`. Chrome is owned by the page component
 * (self-wrap `Layout`) — this route must not wrap `Layout`.
 *
 * @returns {React.ReactElement}
 */
export default function NotFoundRoute() {
  const { themeId, ...data } = useLoaderData();
  const NotFoundPage = getStorefrontComponent('NotFoundPage', themeId);
  if (!NotFoundPage) {
    throw new Error('NotFoundPage theme component not found');
  }
  return <NotFoundPage {...data} />;
}
