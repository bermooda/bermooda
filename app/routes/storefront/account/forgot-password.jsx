import { useLoaderData } from 'react-router';

import ForgotPasswordPage from '#/themes/default/components/ForgotPasswordPage';

export async function loader({ request }) {
  const url = new URL(request.url);
  const sent = url.searchParams.get('sent') === 'true';
  return { sent };
}

export function meta() {
  return [{ title: 'Forgot Password' }];
}

export default function AccountForgotPasswordRoute() {
  const data = useLoaderData();
  return <ForgotPasswordPage {...data} />;
}
