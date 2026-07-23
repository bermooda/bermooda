import { redirect } from 'react-router';

import logger from '#/utils/logger.server';
import { adminAuth } from '#/libs/auth/admin/index.server';

/**
 * Admin logout — signs out via the admin Better Auth instance.
 * Works for both GET (direct link) and POST (form action).
 */
async function signOutAndRedirect(request) {
  try {
    await adminAuth.api.signOut({
      headers: request.headers,
    });
  } catch (error) {
    logger.error(error, 'Admin logout error');
  }

  return redirect('/admin/login');
}

export async function action({ request }) {
  return signOutAndRedirect(request);
}

export async function loader({ request }) {
  return signOutAndRedirect(request);
}
