import {
  issueGiftCard,
  listGiftCards,
  parseIssueGiftCardInput,
} from '#/core/gift-cards/index.server';

export async function loader({ request }) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '20', 10),
    100
  );
  const q = url.searchParams.get('q') ?? undefined;

  const { giftCards, total } = await listGiftCards({ page, limit, q });

  return Response.json({ giftCards, total, page, limit });
}

export async function action({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = parseIssueGiftCardInput(body);
  if (!input.balanceCents || input.balanceCents <= 0) {
    return Response.json(
      { error: 'balanceCents must be greater than zero' },
      { status: 400 }
    );
  }

  try {
    const giftCard = await issueGiftCard(input);
    return Response.json({ giftCard }, { status: 201 });
  } catch (err) {
    if (err.code === 'GIFT_CARD_CODE_EXISTS') {
      return Response.json({ error: err.message }, { status: 409 });
    }
    if (err.message === 'INVALID_GIFT_CARD_AMOUNT') {
      return Response.json(
        { error: 'balanceCents must be greater than zero' },
        { status: 400 }
      );
    }
    throw err;
  }
}
