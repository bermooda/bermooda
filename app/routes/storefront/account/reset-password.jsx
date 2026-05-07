import { useLoaderData } from 'react-router';

import ResetPasswordPage from '#/themes/default/components/ResetPasswordPage';

export async function loader({ request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const error = url.searchParams.get('error') ?? null;
  return { token, error };
}

export function meta() {
  return [{ title: 'Reset Password' }];
}

export default function AccountResetPasswordRoute() {
  const data = useLoaderData();
  return <ResetPasswordPage {...data} />;
}
