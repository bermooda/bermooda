/**
 * Customer Better Auth API routes
 * Handles all customer auth endpoints at /account/auth/*
 * e.g. /account/auth/sign-in, /account/auth/sign-up, etc.
 */
import { customerAuthHandlerMiddleware } from '#/libs/auth/customer.server';
import { rateLimitMiddleware } from '#/libs/rate-limit.server';

export const middleware = [
  rateLimitMiddleware('auth'),
  customerAuthHandlerMiddleware,
];
