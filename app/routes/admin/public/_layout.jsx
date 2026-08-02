import { Outlet, useLoaderData } from 'react-router';

import { translate } from '#/core/i18n';
import { I18nContext } from '#/core/i18n/context';
import { getRequestLocale, loadMessages } from '#/core/i18n/index.server';

/**
 * Loader — loads locale messages for public admin auth pages.
 * Does not require an admin session.
 *
 * @param {{ request: Request }} args
 * @returns {Promise<{ locale: string, messages: Record<string, string> }>}
 */
export async function loader({ request }) {
  const locale = await getRequestLocale(request);
  const messages = await loadMessages(locale);
  return { locale, messages };
}

/**
 * Public admin layout — pathless layout route wrapping auth pages
 * (login, forgot-password, reset-password, verify-2fa, logout).
 * No authentication required.
 *
 * @returns {React.ReactElement}
 */
export default function AdminPublicLayout() {
  const { messages } = useLoaderData();

  /**
   * @param {string} key
   * @param {Record<string, string|number>} [params]
   * @returns {string}
   */
  function t(key, params) {
    return translate(key, params, messages);
  }

  return (
    <I18nContext.Provider value={{ t }}>
      <Outlet />
    </I18nContext.Provider>
  );
}
