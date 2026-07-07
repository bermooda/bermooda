/**
 * Customer Better Auth API routes
 * Handles all customer auth endpoints at /account/auth/*
 * e.g. /account/auth/sign-in, /account/auth/sign-up, etc.
 */
import { customerAuth } from '#/libs/auth/customer.server';
import { enforceRateLimit } from '#/libs/rate-limit.server';

export async function loader({ request }) {
  enforceRateLimit(request, 'auth');
  return customerAuth.handler(request);
}

export async function action({ request }) {
  enforceRateLimit(request, 'auth');
  return customerAuth.handler(request);
}
