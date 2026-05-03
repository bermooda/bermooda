import { redirect } from 'react-router';

import logger from '#/utils/logger.server';
import { auth } from '#/libs/auth/index.server';

export async function action({ request }) {
  try {
    await auth.api.signOut({
      headers: request.headers,
    });

    return redirect('/');
  } catch (error) {
    logger.error(error, 'Logout error');
    return redirect('/');
  }
}

export async function loader({ request }) {
  try {
    await auth.api.signOut({
      headers: request.headers,
    });

    return redirect('/');
  } catch (error) {
    logger.error(error, 'Logout error');
    return redirect('/');
  }
}
