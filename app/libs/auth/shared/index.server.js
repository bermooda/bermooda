import { networkInterfaces } from 'os';

import bcrypt from 'bcryptjs';
import { createAuthMiddleware } from 'better-auth/api';

import config from '#/core/config';
import logger from '#/utils/logger.server';
import { queueVerifyEmail } from '#/emails/job.server';

export const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Get local network address for dev mode with --host flag.
 *
 * @param {number} [port=3000]
 * @returns {string|null}
 */
export function getLocalNetworkUrl(port = 3000) {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return `http://${net.address}:${port}`;
      }
    }
  }
  return null;
}

/**
 * Build trusted origins array, including network address in development.
 *
 * @returns {string[]}
 */
export function getTrustedOrigins() {
  const origins = [config.baseUrl];

  if (IS_DEV) {
    const networkUrl = getLocalNetworkUrl();
    if (networkUrl) {
      origins.push(networkUrl);
    }
  }

  return origins;
}

/**
 * Shared bcrypt email/password config for better-auth instances.
 *
 * @param {object} options
 * @param {(args: { user: object, url: string }) => void | Promise<void>} options.sendResetPassword
 */
export function createEmailPasswordConfig({ sendResetPassword }) {
  return {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async (data) => bcrypt.compare(data.password, data.hash),
    },
    sendResetPassword,
  };
}

/**
 * Shared email verification config for better-auth instances.
 *
 * @param {object} options
 * @param {(args: { user: object, url: string }) => string} options.buildVerificationUrl
 */
export function createEmailVerificationConfig({ buildVerificationUrl }) {
  return {
    enabled: true,
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      queueVerifyEmail(
        user.email,
        user.name,
        buildVerificationUrl({ user, url })
      );
    },
  };
}

/**
 * Shared Google social provider config.
 *
 * @returns {object}
 */
export function buildSocialProvidersConfig() {
  return {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  };
}

/**
 * Shared better-auth logger config.
 *
 * @returns {object}
 */
export function buildAuthLoggerConfig() {
  return {
    level: IS_DEV ? 'debug' : 'warn',
    log(level, message) {
      logger[level](message);
    },
  };
}

/**
 * Shared better-auth advanced cookie settings.
 *
 * @param {string} cookiePrefix
 * @returns {object}
 */
export function buildAuthAdvancedConfig(cookiePrefix) {
  return {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: !IS_DEV,
    },
    cookiePrefix,
  };
}

/**
 * Redirect social OAuth callbacks to the storefront/admin landing path.
 *
 * @param {string} callbackUrl
 */
export function createSocialCallbackRedirectHook(callbackUrl) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx?.path?.startsWith('/callback') && ctx?.context?.newSession) {
      throw ctx.redirect(callbackUrl);
    }
  });
}

/**
 * Pick user fields stored in auth middleware context.
 *
 * @param {object} user
 * @returns {object}
 */
export function pickAuthUserContextFields(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Build a login redirect URL preserving the current path as returnTo.
 *
 * @param {string} loginPath - e.g. `/admin/login` or `/account/login`
 * @param {Request|string} requestOrUrl
 * @returns {string}
 */
export function buildLoginRedirectUrl(loginPath, requestOrUrl) {
  const url =
    typeof requestOrUrl === 'string'
      ? new URL(requestOrUrl)
      : new URL(requestOrUrl.url);
  const returnTo = url.pathname + url.search;
  return `${loginPath}?returnTo=${encodeURIComponent(returnTo)}`;
}
