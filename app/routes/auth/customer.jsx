/**
 * Customer Better Auth API routes
 * Handles all customer auth endpoints at /account/auth/*
 * e.g. /account/auth/sign-in, /account/auth/sign-up, etc.
 */
import { customerAuth } from '#/libs/auth/customer.server';

export async function loader({ request }) {
  return customerAuth.handler(request);
}

export async function action({ request }) {
  return customerAuth.handler(request);
}
