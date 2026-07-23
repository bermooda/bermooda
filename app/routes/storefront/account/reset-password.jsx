import { useLoaderData } from 'react-router';

import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const error = url.searchParams.get('error') ?? null;
  return {
    themeId,
    token,
    error,
  };
}

export function meta() {
  return [{ title: 'Reset Password' }];
}

export default function AccountResetPasswordRoute() {
  const { themeId, ...data } = useLoaderData();
  const ResetPasswordPage = getStorefrontComponent(
    'ResetPasswordPage',
    themeId
  );
  if (!ResetPasswordPage)
    throw new Error('ResetPasswordPage theme component not found');
  return <ResetPasswordPage {...data} />;
}
