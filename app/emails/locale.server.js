// app/emails/locale.server.js
// Resolve locale for auth emails (settings + optional customer preference).

import prisma from '#/libs/prisma.server';
import { isValidLocaleTag } from '#/core/i18n';
import { get as settingsGet, SETTING_KEYS } from '#/core/settings/index.server';

/**
 * Resolves locale for auth transactional emails.
 * Never uses Accept-Language — settings default, optionally customer.preferredLocale.
 *
 * @param {Object} [options]
 * @param {string} [options.email] - Recipient email (used when preferring customer locale)
 * @param {boolean} [options.preferCustomerLocale] - Look up customer.preferredLocale first
 * @returns {Promise<string>}
 */
export async function resolveAuthEmailLocale({
  email,
  preferCustomerLocale = false,
} = {}) {
  if (preferCustomerLocale && typeof email === 'string' && email) {
    const customer = await prisma.customer.findUnique({
      where: { email },
      select: { preferredLocale: true },
    });
    const preferred = customer?.preferredLocale;
    if (preferred && isValidLocaleTag(preferred)) {
      return preferred;
    }
  }

  const setting = await settingsGet(SETTING_KEYS.DEFAULT_LOCALE);
  if (typeof setting === 'string' && isValidLocaleTag(setting)) {
    return setting;
  }

  return 'en';
}
