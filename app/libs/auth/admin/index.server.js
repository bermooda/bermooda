import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import { createContext, redirect } from 'react-router';

import config, { PLATFORM_NAME } from '#/libs/config';
import logger from '#/utils/logger.server';
import {
  buildAuthAdvancedConfig,
  buildAuthLoggerConfig,
  buildLoginRedirectUrl,
  buildSocialProvidersConfig,
  createEmailPasswordConfig,
  createEmailVerificationConfig,
  createSocialCallbackRedirectHook,
  getTrustedOrigins,
  pickAuthUserContextFields,
} from '#/libs/auth/shared/index.server';
import prisma from '#/libs/prisma.server';
import { getBetterAuthProvider } from '#/libs/prisma/provider/index.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';
import {
  queuePasswordResetEmail,
  queueStaffInviteEmail,
  queueTwoFactorOtp,
} from '#/emails/job.server';

const ADMIN_AUTH_BASE_URL = config.baseUrl + config.auth.adminBasePath;

/**
 * Queue either a staff invite (set-password) or password-reset email.
 * Invited staff have no credential password yet.
 *
 * @param {{ user: { id: string, email: string, name?: string|null }, url: string }} args
 * @returns {Promise<'invite' | 'reset'>}
 */
export async function sendAdminPasswordResetOrInvite({ user, url }) {
  const account = await prisma.account.findFirst({
    where: { userId: user.id, providerId: 'credential' },
    select: { password: true },
  });

  if (!account?.password) {
    queueStaffInviteEmail(user.email, user.name, url);
    return 'invite';
  }

  queuePasswordResetEmail(user.email, user.name, url);
  return 'reset';
}

/**
 * Admin Better Auth instance
 * Handles authentication for staff/admin users via the User model.
 * Base path: /admin/auth
 * Cookie prefix: bermooda_admin_
 */
export const adminAuth = betterAuth({
  appName: PLATFORM_NAME,

  database: prismaAdapter(prisma, {
    provider: getBetterAuthProvider(),
  }),

  secret: process.env.BETTER_AUTH_SECRET,

  baseURL: ADMIN_AUTH_BASE_URL,
  basePath: config.auth.adminBasePath,
  trustedOrigins: getTrustedOrigins(),

  emailAndPassword: createEmailPasswordConfig({
    sendResetPassword: sendAdminPasswordResetOrInvite,
  }),

  emailVerification: createEmailVerificationConfig({
    buildVerificationUrl({ url }) {
      return `${url}admin/dashboard?welcome-message=true`;
    },
  }),

  user: {
    changeEmail: {
      enabled: true,
    },
  },

  socialProviders: buildSocialProvidersConfig(),

  plugins: [
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          queueTwoFactorOtp(user.email, user.name, otp);
        },
      },
    }),
  ],

  hooks: {
    after: createSocialCallbackRedirectHook(config.auth.adminCallbackUrl),
  },

  logger: buildAuthLoggerConfig(),

  telemetry: {
    enabled: false,
  },

  advanced: buildAuthAdvancedConfig(config.auth.adminCookiePrefix),
});

/**
 * React Router middleware that proxies requests to the admin Better Auth handler.
 *
 * @param {object} context
 * @param {Request} context.request
 */
export async function adminAuthHandlerMiddleware({ request }) {
  throw await adminAuth.handler(request);
}

/**
 * Context object for admin authentication middleware
 *
 * @type {import('react-router').RouterContext<{
 *   id: string,
 *   email: string,
 *   name: string,
 *   emailVerified: boolean,
 *   createdAt: Date,
 *   updatedAt: Date
 * }>}
 */
export const adminAuthContext = createContext();

/**
 * Middleware function to set the admin auth context
 *
 * @param {object} context - The context object
 * @param {Request} context.request - The incoming request
 * @param {import('react-router').RouterContextProvider} context.context - The context Set
 */
export async function adminAuthMiddleware({ request, context }) {
  enforceRateLimit(request, 'auth');
  const { user } = await authenticate(request);

  context.set(adminAuthContext, {
    ...pickAuthUserContextFields(user),
    role: user.role,
  });
}

/**
 * Utility function to get authenticated admin user from Better Auth session
 * Use this in loaders/actions when you don't want to use middleware
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<{user: object}>}
 * @throws {Response} Redirects to login if not authenticated
 */
export async function authenticate(request) {
  try {
    const session = await adminAuth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session?.user) {
      throw redirect(buildLoginRedirectUrl('/admin/login', request), 302);
    }

    return session;
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    logger.error({ err: error }, 'Admin authentication error');
    throw redirect('/admin/login', 302);
  }
}
