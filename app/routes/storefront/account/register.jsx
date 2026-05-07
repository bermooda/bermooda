import { redirect } from 'react-router';
import { useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';

import RegisterPage from '#/themes/default/components/register-page';

export async function loader({ request }) {
  const session = await getCustomerSession(request);
  if (session?.user) return redirect('/account');

  const url = new URL(request.url);
  const error = url.searchParams.get('error') ?? null;

  return { error };
}

export function meta() {
  return [{ title: 'Create Account' }];
}

export default function AccountRegisterRoute() {
  const data = useLoaderData();
  return <RegisterPage {...data} />;
}
