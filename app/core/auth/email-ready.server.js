// app/core/auth/email-ready.server.js
// Whether admin email OTP / invites can be delivered.

import config from '#/libs/config';
import { getActiveProviderId } from '#/libs/email/index.server';

/**
 * True when transactional admin mail can be sent:
 * a non-empty `fromNoReply` and an active registered email provider.
 *
 * @returns {boolean}
 */
export function isAdminEmailReady() {
  const from =
    typeof config.email?.fromNoReply === 'string'
      ? config.email.fromNoReply.trim()
      : '';
  if (!from) return false;
  return getActiveProviderId() != null;
}
