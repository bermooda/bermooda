import {
  createDomainErrorMapper,
  jsonListResponse,
  parseAdminListPagination,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  issueGiftCard,
  listGiftCards,
  parseIssueGiftCardInput,
} from '#/core/gift-cards/index.server';

const mapGiftCardError = createDomainErrorMapper({
  conflict: ['GIFT_CARD_CODE_EXISTS'],
});

export async function loader({ request }) {
  const url = new URL(request.url);
  const { page, limit } = parseAdminListPagination(url.searchParams);
  const q = url.searchParams.get('q') ?? undefined;

  const { giftCards, total } = await listGiftCards({ page, limit, q });

  return jsonListResponse('giftCards', {
    items: giftCards,
    total,
    page,
    limit,
  });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;

  const input = parseIssueGiftCardInput(parsed.body);
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
    if (err.message === 'INVALID_GIFT_CARD_AMOUNT') {
      return Response.json(
        { error: 'balanceCents must be greater than zero' },
        { status: 400 }
      );
    }
    return mapGiftCardError(err);
  }
}
