import { Outlet, useLoaderData } from 'react-router';

import { useI18nValue } from '#/core/i18n';
import { I18nContext } from '#/core/i18n/context';
import { getAdminRequestLocale, loadMessages } from '#/core/i18n/index.server';

/**
 * Loader — loads locale messages for public admin auth pages.
 * Does not require an admin session.
 *
 * @param {{ request: Request }} args
 * @returns {Promise<{ locale: string, messages: Record<string, string> }>}
 */
export async function loader({ request }) {
  const locale = await getAdminRequestLocale(request);
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
  const { locale, messages } = useLoaderData();
  const i18n = useI18nValue(locale, messages);

  return (
    <I18nContext.Provider value={i18n}>
      <Outlet />
    </I18nContext.Provider>
  );
}
