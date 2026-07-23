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
  const error = url.searchParams.get('error') ?? null;

  return {
    themeId,
    error,
  };
}

export function meta() {
  return [{ title: 'Create Account' }];
}

export default function AccountRegisterRoute() {
  const { themeId, ...data } = useLoaderData();
  const RegisterPage = getStorefrontComponent('RegisterPage', themeId);
  if (!RegisterPage) throw new Error('RegisterPage theme component not found');
  return <RegisterPage {...data} />;
}
