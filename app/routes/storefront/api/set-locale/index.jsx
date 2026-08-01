import { redirect } from 'react-router';

import { getAvailableLocales, setLocaleCookie } from '#/core/i18n/index.server';
import { parseReturnTo } from '#/core/storefront/page-context.server';

export async function action({ request }) {
  const formData = await request.formData();
  const locale = formData.get('locale')?.toString();
  const returnTo = parseReturnTo(formData);
  const enabledLocales = await getAvailableLocales();

  if (!locale || !enabledLocales.includes(locale)) {
    return redirect(returnTo);
  }

  const response = redirect(returnTo);
  setLocaleCookie(response, locale);
  return response;
}

export async function loader() {
  return redirect('/');
}
