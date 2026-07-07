import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createContext, redirect } from 'react-router';

import config from '#/config';
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
} from '#/libs/auth/shared.server';
import prisma from '#/libs/prisma.server';
import { getBetterAuthProvider } from '#/libs/prisma/provider.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';
import { emit } from '#/core/events/index.server';
import { queuePasswordResetEmail } from '#/emails/job.server';

const CUSTOMER_AUTH_BASE_URL = config.baseUrl + config.auth.customerBasePath;

/**
 * Customer Better Auth instance
 * Handles authentication for storefront customers via the Customer* model set.
 * Base path: /account/auth
 * Cookie prefix: bermooda_customer_
 *
 * Model mapping (via better-auth's modelName option):
 *   user         -> Customer
 *   session      -> CustomerSession
 *   account      -> CustomerAccount
 *   verification -> CustomerVerification
 */
export const customerAuth = betterAuth({
  appName: config.appName,

  database: prismaAdapter(prisma, {
    provider: getBetterAuthProvider(),
  }),

  secret: process.env.BETTER_AUTH_SECRET,

  baseURL: CUSTOMER_AUTH_BASE_URL,
  basePath: config.auth.customerBasePath,
  trustedOrigins: getTrustedOrigins(),

  user: {
    modelName: 'Customer',
    changeEmail: {
      enabled: true,
    },
  },

  session: {
    modelName: 'CustomerSession',
  },

  account: {
    modelName: 'CustomerAccount',
  },

  verification: {
    modelName: 'CustomerVerification',
  },

  databaseHooks: {
    user: {
      create: {
        async after(user) {
          await emit('customer.registered', {
            customerId: user.id,
            email: user.email,
            name: user.name,
          });
        },
      },
    },
  },

  emailAndPassword: createEmailPasswordConfig({
    sendResetPassword({ user, url }) {
      queuePasswordResetEmail(user.email, user.name, url);
    },
  }),

  emailVerification: createEmailVerificationConfig({
    buildVerificationUrl({ url }) {
      return `${url}account?welcome-message=true`;
    },
  }),

  socialProviders: buildSocialProvidersConfig(),

  hooks: {
    after: createSocialCallbackRedirectHook(config.auth.customerCallbackUrl),
  },

  logger: buildAuthLoggerConfig(),

  telemetry: {
    enabled: false,
  },

  advanced: buildAuthAdvancedConfig(config.auth.customerCookiePrefix),
});

/**
 * Context object for customer authentication middleware
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
export const customerAuthContext = createContext();

/**
 * Middleware function to set the customer auth context
 *
 * @param {object} context - The context object
 * @param {Request} context.request - The incoming request
 * @param {import('react-router').RouterContextProvider} context.context - The context set
 */
export async function customerAuthMiddleware({ request, context }) {
  enforceRateLimit(request, 'auth');
  const session = await getCustomerSession(request);

  if (!session?.user) {
    throw redirect(buildLoginRedirectUrl('/account/login', request), 302);
  }

  context.set(customerAuthContext, pickAuthUserContextFields(session.user));
}

/**
 * Utility function to get authenticated customer session
 * Returns null if not authenticated — useful for optional auth
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<object | null>}
 */
export async function getCustomerSession(request) {
  try {
    const session = await customerAuth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session?.user) {
      return null;
    }

    return session;
  } catch (error) {
    logger.error({ err: error }, 'Customer session error');
    return null;
  }
}

export default customerAuth;
