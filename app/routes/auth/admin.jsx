/**
 * Admin Better Auth API routes
 * Handles all admin auth endpoints at /admin/auth/*
 * e.g. /admin/auth/sign-in, /admin/auth/sign-up, etc.
 */
import { adminAuth } from '#/libs/auth/admin.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';

export async function loader({ request }) {
  enforceRateLimit(request, 'auth');
  return adminAuth.handler(request);
}

export async function action({ request }) {
  enforceRateLimit(request, 'auth');
  return adminAuth.handler(request);
}
