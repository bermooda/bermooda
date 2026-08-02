import { useLoaderData } from 'react-router';

import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const { themeId } = await loadStorefrontPageContext(request);
  const url = new URL(request.url);
  const sent = url.searchParams.get('sent') === 'true';
  return {
    themeId,
    sent,
  };
}

export function meta() {
  return [{ title: 'Forgot Password' }];
}

export default function AccountForgotPasswordRoute() {
  const { themeId, ...data } = useLoaderData();
  const ForgotPasswordPage = getStorefrontComponent(
    'ForgotPasswordPage',
    themeId
  );
  if (!ForgotPasswordPage)
    throw new Error('ForgotPasswordPage theme component not found');
  return <ForgotPasswordPage {...data} />;
}
