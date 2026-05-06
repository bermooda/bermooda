import { redirect } from 'react-router';

import { setCurrencyCookie } from '#/core/currency/index.server';

const SUPPORTED = ['USD', 'EUR', 'AUD'];

export async function action({ request }) {
  const formData = await request.formData();
  const currency = formData.get('currency');
  const returnTo = formData.get('returnTo') ?? '/';

  if (!currency || !SUPPORTED.includes(currency)) {
    return redirect(returnTo);
  }

  const response = redirect(returnTo);
  setCurrencyCookie(response, currency);
  return response;
}

export async function loader() {
  return redirect('/');
}
