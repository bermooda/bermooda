/**
 * Customer Better Auth API routes
 * Handles all customer auth endpoints at /account/auth/*
 * e.g. /account/auth/sign-in, /account/auth/sign-up, etc.
 */
import { customerAuth } from '#/libs/auth/customer.server';
import { createAuthRouteHandlers } from '#/libs/auth/shared.server';

const { loader: authLoader, action: authAction } =
  createAuthRouteHandlers(customerAuth);

export async function loader(args) {
  return authLoader(args);
}

export async function action(args) {
  return authAction(args);
}
