import { redirect } from 'react-router';

import logger from '#/utils/logger.server';
import { auth, getUserSession } from '#/libs/auth/index.server';

export function meta() {
  return [
    { title: 'Accept Invitation' },
    { name: 'description', content: 'Accept your organization invitation' },
  ];
}

export async function loader({ request }) {
  const url = new URL(request.url);
  const invitationId = url.searchParams.get('id');

  if (!invitationId) {
    throw redirect('/login');
  }

  const session = await getUserSession(request);

  if (!session?.user) {
    throw redirect(
      `/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`
    );
  }

  try {
    await auth.api.acceptInvitation({
      headers: request.headers,
      body: { invitationId },
    });

    throw redirect('/organization');
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    logger.error(error, 'Failed to accept invitation');
    throw redirect('/organization');
  }
}

export default function AcceptInvitationRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-zinc-500">Processing invitation...</p>
    </div>
  );
}
