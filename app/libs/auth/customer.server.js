import { networkInterfaces } from 'os';

import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware } from 'better-auth/api';
import { createContext, redirect } from 'react-router';

import config from '#/config';
import { getBetterAuthProvider } from '#/utils/database.server';
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import { queuePasswordResetEmail, queueVerifyEmail } from '#/emails/job.server';

import { emit } from '#/core/events/index.server';

const IS_DEV = process.env.NODE_ENV === 'development';
const CUSTOMER_AUTH_BASE_URL = config.baseUrl + config.auth.customerBasePath;

/**
 * Get local network address for dev mode with --host flag
 * @returns {string|null} The local network URL or null if not found
 */
function getLocalNetworkUrl() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return `http://${net.address}:3000`;
      }
    }
  }
  return null;
}

/**
 * Build trusted origins array, including network address in development
 * @returns {string[]} Array of trusted origin URLs
 */
function getTrustedOrigins() {
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
 *
 * NOTE: The Customer* Prisma tables do not exist yet — they will be added in
 * Phase 2. This configuration compiles and the handler mounts correctly; runtime
 * DB operations against Customer* tables require the Phase 2 schema migration.
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

  // Map better-auth's internal model names to the Customer* Prisma models.
  // better-auth uses BetterAuthDBOptions.modelName for each table.
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

  // Override password hashing and verification to increase login performance
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      hash: async (password) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async (data) => {
        return await bcrypt.compare(data.password, data.hash);
      },
    },
    async sendResetPassword({ user, url }) {
      queuePasswordResetEmail(user.email, user.name, url);
    },
  },

  emailVerification: {
    enabled: true,
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      const verificationUrl = `${url}account?welcome-message=true`;
      queueVerifyEmail(user.email, user.name, verificationUrl);
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  // No twoFactor plugin for customers (deferred to a future phase)

  // Redirect all social logins to customer callback URL
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx?.path?.startsWith('/callback') && ctx?.context?.newSession) {
        throw ctx.redirect(config.auth.customerCallbackUrl);
      }
    }),
  },

  logger: {
    level: IS_DEV ? 'debug' : 'warn',
    log(level, message) {
      logger[level](message);
    },
  },

  telemetry: {
    enabled: false,
  },

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: !IS_DEV,
    },
    cookiePrefix: config.auth.customerCookiePrefix,
  },
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
  const session = await getCustomerSession(request);

  if (!session?.user) {
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    throw redirect(
      `/account/login?returnTo=${encodeURIComponent(redirectTo)}`,
      302
    );
  }

  // Set customer context for use in routes
  context.set(customerAuthContext, {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    emailVerified: session.user.emailVerified,
    createdAt: session.user.createdAt,
    updatedAt: session.user.updatedAt,
  });
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
