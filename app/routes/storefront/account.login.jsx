import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';

import LoginPage from '#/themes/default/components/LoginPage';

export async function loader({ request }) {
  const session = await getCustomerSession(request);
  if (session?.user) return redirect('/account');

  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') ?? '/account';
  const error = url.searchParams.get('error') ?? null;

  return { returnTo, error };
}

export function meta() {
  return [{ title: 'Sign In' }];
}

export default function AccountLoginRoute() {
  const data = useLoaderData();
  return <LoginPage {...data} />;
}
