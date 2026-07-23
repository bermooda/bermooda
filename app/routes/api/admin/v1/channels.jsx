// GET /api/admin/v1/channels — list sales channels
// POST /api/admin/v1/channels — create sales channel
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  createChannel,
  getChannel,
  listChannels,
  parseChannelListParams,
  serializeChannel,
} from '#/core/channels/index.server';

const mapChannelError = createDomainErrorMapper({
  badRequest: [
    'NAME_REQUIRED',
    'HANDLE_REQUIRED',
    'HANDLE_INVALID',
    'CURRENCY_INVALID',
    'LOCALE_INVALID',
  ],
  conflict: ['CHANNEL_CONFLICT'],
});

export async function loader({ request }) {
  const url = new URL(request.url);
  const params = parseChannelListParams(url.searchParams);
  const { channels, total, page, limit } = await listChannels(params);

  return Response.json({
    channels: channels.map(serializeChannel),
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
  const body = parsed.body;

  try {
    const channel = await createChannel(body);
    const hydrated = await getChannel(channel.id);
    return Response.json(
      { channel: serializeChannel(hydrated) },
      { status: 201 }
    );
  } catch (err) {
    return mapChannelError(err);
  }
}
