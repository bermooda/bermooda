import { redirect } from 'react-router';

import { setLocaleCookie } from '#/core/i18n/index.server';

const SUPPORTED = ['en', 'de', 'fr'];

export async function action({ request }) {
  const formData = await request.formData();
  const locale = formData.get('locale');
  const returnTo = formData.get('returnTo') ?? '/';

  if (!locale || !SUPPORTED.includes(locale)) {
    return redirect(returnTo);
  }

  const response = redirect(returnTo);
  setLocaleCookie(response, locale);
  return response;
}

export async function loader() {
  return redirect('/');
}
