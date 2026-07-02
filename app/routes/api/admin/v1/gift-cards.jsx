import { requireApiKey } from '#/libs/auth/api.server';

import { issueGiftCard, listGiftCards } from '#/core/gift-cards/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);
  const giftCards = await listGiftCards();
  return Response.json({ giftCards });
}

export async function action({ request }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const giftCard = await issueGiftCard({
    balanceCents: body.balanceCents,
    currency: body.currency ?? 'USD',
    code: body.code,
  });

  return Response.json({ giftCard }, { status: 201 });
}
