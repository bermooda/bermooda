import { networkInterfaces } from 'os';

import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins';
import { createContext, redirect } from 'react-router';

import config from '#/config';
import logger from '#/utils/logger.server';
import prisma from '#/libs/prisma.server';
import {
  queuePasswordResetEmail,
  queueTwoFactorOtp,
  queueVerifyEmail,
} from '#/emails/job.server';

const IS_DEV = process.env.NODE_ENV === 'development';
const ADMIN_AUTH_BASE_URL = config.baseUrl + config.auth.adminBasePath;

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
 * Admin Better Auth instance
 * Handles authentication for staff/admin users via the User model.
 * Base path: /admin/auth
 * Cookie prefix: bermooda_admin_
 */
export const adminAuth = betterAuth({
  appName: config.appName,

  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),

  secret: process.env.BETTER_AUTH_SECRET,

  baseURL: ADMIN_AUTH_BASE_URL,
  basePath: config.auth.adminBasePath,
  trustedOrigins: getTrustedOrigins(),

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
      const verificationUrl = `${url}admin/dashboard?welcome-message=true`;
      queueVerifyEmail(user.email, user.name, verificationUrl);
    },
  },

  user: {
    changeEmail: {
      enabled: true,
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  plugins: [
    twoFactor({
      otpOptions: {
        async sendOTP({ user, otp }) {
          queueTwoFactorOtp(user.email, user.name, otp);
        },
      },
    }),
  ],

  // Redirect all social logins to admin callback URL
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx?.path?.startsWith('/callback') && ctx?.context?.newSession) {
        throw ctx.redirect(config.auth.adminCallbackUrl);
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
    cookiePrefix: config.auth.adminCookiePrefix,
  },
});

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
  const { user } = await authenticate(request);

  if (!user) {
    throw redirect('/admin/login', 302);
  }

  // Set user context for use in routes
  context.set(adminAuthContext, {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
      const url = new URL(request.url);
      const redirectTo = url.pathname + url.search;
      const redirectUrl = `/admin/login?returnTo=${encodeURIComponent(redirectTo)}`;

      throw redirect(redirectUrl, 302);
    }

    return session;
  } catch (error) {
    // Re-throw redirect response
    if (error instanceof Response) {
      throw error;
    }

    console.error('Admin authentication error:', error);
    throw redirect('/admin/login', 302);
  }
}

export default adminAuth;
