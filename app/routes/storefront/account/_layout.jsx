import { redirect } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';

import { getCustomerSession } from '#/libs/auth/customer.server';

import AccountLayout from '#/themes/default/components/account-layout';

export async function loader({ request }) {
  const session = await getCustomerSession(request);

  if (!session?.user) {
    const url = new URL(request.url);
    const returnTo = url.pathname + url.search;
    throw redirect(`/account/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return { customer: session.user };
}

export default function AccountLayoutRoute() {
  const { customer } = useLoaderData();
  return (
    <AccountLayout customer={customer}>
      <Outlet />
    </AccountLayout>
  );
}
