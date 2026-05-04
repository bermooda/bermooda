import bcrypt from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware } from 'better-auth/api';
import { twoFactor } from 'better-auth/plugins';
import { networkInterfaces } from 'os';
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
const BETTER_AUTH_BASE_URL = config.baseUrl + config.auth.betterAuthBasePath;

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
 * Better Auth configuration
 * Configures authentication with email/password and Google OAuth
 */
export const auth = betterAuth({
  appName: config.appName,

  database: prismaAdapter(prisma, {
    provider: 'sqlite',
  }),

  secret: process.env.BETTER_AUTH_SECRET,

  baseURL: BETTER_AUTH_BASE_URL,
  trustedOrigins: getTrustedOrigins(),

  // Reduce DB calls, but requires the authClient.signOut() call
  // session: {
  //   cookieCache: {
  //     enabled: true,
  //     maxAge: 5 * 60, // Cache duration in seconds
  //   },
  // },

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
      const verificationUrl = `${url}dashboard?welcome-message=true`;
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

  // Redirect all social logins to default callback URL
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx?.path?.startsWith('/callback') && ctx?.context?.newSession) {
        throw ctx.redirect(config.auth.callbackUrl);
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
    cookiePrefix: config.auth.cookiePrefix,
  },
});

/**
 * Context object for authentication middleware
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
export const authContext = createContext();

/**
 * Middleware function to set the auth context
 *
 * @param {object} context - The context object
 * @param {Request} context.request - The incoming request
 * @param {import('react-router').RouterContextProvider} context.context - The context Set
 */
export async function authMiddleware({ request, context }) {
  const { user } = await authenticate(request);

  if (!user) {
    throw redirect('/login', 302);
  }

  // Set user context for use in routes
  context.set(authContext, {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

/**
 * Utility function to get authenticated user from Better Auth session
 * Use this in loaders/actions when you don't want to use middleware
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<{user: object}>}
 * @throws {Response} Redirects to login if not authenticated
 */
export async function authenticate(request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session?.user) {
      const url = new URL(request.url);
      const redirectTo = url.pathname + url.search;
      const redirectUrl = `/login?returnTo=${encodeURIComponent(redirectTo)}`;

      throw redirect(redirectUrl, 302);
    }

    return session;
  } catch (error) {
    // Re-throw redirect response
    if (error instanceof Response) {
      throw error;
    }

    console.error('Authentication error:', error);
    throw redirect('/login', 302);
  }
}

/**
 * Utility function to get user session without requiring authentication
 * Returns null if not authenticated, useful for optional auth
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<object | null>}
 */
export async function getUserSession(request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session?.user) {
      return null;
    }

    return session;
  } catch (error) {
    console.error('Optional auth error:', error);
    return null;
  }
}

/**
 * Utility function to redirect if user has a session
 *
 * @param {Request} request - The incoming request
 * @param {string} [redirectUrl] - The URL to redirect to if user has a session
 * @returns {Promise<void>}
 */
export async function redirectValidSession(
  request,
  redirectUrl = config.auth.callbackUrl
) {
  const session = await getUserSession(request);

  if (session?.user) {
    throw redirect(redirectUrl);
  }
}

export default auth;
