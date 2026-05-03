/**
 * Better Auth API routes
 * This handles all Better Auth API endpoints like /auth/sign-in, /auth/sign-up, etc.
 */
import { auth } from '#/libs/auth/index.server';

export async function loader({ request }) {
  return auth.handler(request);
}

export async function action({ request }) {
  return auth.handler(request);
}
