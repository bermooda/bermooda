/**
 * Admin Better Auth API routes
 * Handles all admin auth endpoints at /admin/auth/*
 * e.g. /admin/auth/sign-in, /admin/auth/sign-up, etc.
 */
import { adminAuth } from '#/libs/auth/admin.server';
import { createAuthRouteHandlers } from '#/libs/auth/shared.server';

const { loader: authLoader, action: authAction } =
  createAuthRouteHandlers(adminAuth);

export async function loader(args) {
  return authLoader(args);
}

export async function action(args) {
  return authAction(args);
}
