/**
 * Admin Better Auth API routes
 * Handles all admin auth endpoints at /admin/auth/*
 * e.g. /admin/auth/sign-in, /admin/auth/sign-up, etc.
 */
import { adminAuthHandlerMiddleware } from '#/libs/auth/admin.server';
import { rateLimitMiddleware } from '#/libs/rate-limit.server';

export const middleware = [
  rateLimitMiddleware('auth'),
  adminAuthHandlerMiddleware,
];
