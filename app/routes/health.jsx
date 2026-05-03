import { redirect } from 'react-router';

import prisma from '#/libs/prisma.server';

export async function loader({ request }) {
  // Only allow requests from fly.io healthcheck service
  const token = request.headers.get('X-Health-Token');
  if (token !== process.env.HEALTH_TOKEN) {
    throw redirect('/404');
  }

  try {
    // Check database connectivity
    await prisma.user.count();
    return Response.json(
      { status: 'ok', database: 'connected' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Healthcheck FAILED:', error);
    return Response.json(
      {
        status: 'error',
        message: 'Database connectivity issue',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
