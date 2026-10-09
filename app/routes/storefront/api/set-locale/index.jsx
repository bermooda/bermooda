import { redirect } from 'react-router';

import { ADMIN_AVAILABLE_LOCALES } from '#/core/i18n';
import { appendLocaleCookie } from '#/core/i18n/index.server';
import { getEnabledLocales } from '#/core/settings/index.server';
import { parseReturnTo } from '#/core/storefront/page-context.server';

/**
 * Persists the `locale` cookie shared by the storefront and admin switchers.
 * Accepts storefront-enabled locales plus admin UI locales; each surface
 * ignores a cookie locale it doesn't serve (see `getRequestLocale` /
 * `getAdminRequestLocale`).
 */
export async function action({ request }) {
  const formData = await request.formData();
  const locale = formData.get('locale')?.toString();
  const returnTo = parseReturnTo(formData);
  const enabledLocales = await getEnabledLocales();
  const response = redirect(returnTo);

  if (
    locale &&
    (enabledLocales.includes(locale) ||
      ADMIN_AVAILABLE_LOCALES.includes(locale))
  ) {
    appendLocaleCookie(response.headers, locale);
  }

  return response;
}

export async function loader() {
  return redirect('/');
}
