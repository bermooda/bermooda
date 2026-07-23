import { redirect } from 'react-router';

import { customerAuth } from '#/libs/auth/customer/index.server';

export async function loader({ request }) {
  await customerAuth.api.signOut({ headers: request.headers });
  return redirect('/');
}

export async function action({ request }) {
  await customerAuth.api.signOut({ headers: request.headers });
  return redirect('/');
}

export default function AccountLogoutRoute() {
  return null;
}
