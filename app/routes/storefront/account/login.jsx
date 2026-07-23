import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer/index.server';
import { preloadStorefrontTheme } from '#/core/themes/index.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

export async function loader({ request }) {
  const themeId = await preloadStorefrontTheme();
  const session = await getCustomerSession(request);
  if (session?.user) return redirect('/account');

  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') ?? '/account';
  const error = url.searchParams.get('error') ?? null;

  return {
    themeId,
    returnTo,
    error,
  };
}

export function meta() {
  return [{ title: 'Sign In' }];
}

export default function AccountLoginRoute() {
  const { themeId, ...data } = useLoaderData();
  const LoginPage = getStorefrontComponent('LoginPage', themeId);
  if (!LoginPage) throw new Error('LoginPage theme component not found');
  return <LoginPage {...data} />;
}
