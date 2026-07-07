// GET /api/admin/v1/channels — list sales channels
// POST /api/admin/v1/channels — create sales channel
// Requires admin-scoped API key.

import {
  createChannel,
  getChannel,
  listChannels,
  parseChannelListParams,
  serializeChannel,
} from '#/core/channels/index.server';

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
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const channel = await createChannel(body);
    const hydrated = await getChannel(channel.id);
    return Response.json(
      { channel: serializeChannel(hydrated) },
      { status: 201 }
    );
  } catch (err) {
    if (
      err.code === 'NAME_REQUIRED' ||
      err.code === 'HANDLE_REQUIRED' ||
      err.code === 'HANDLE_INVALID' ||
      err.code === 'CURRENCY_INVALID' ||
      err.code === 'LOCALE_INVALID'
    ) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    if (err.code === 'CHANNEL_CONFLICT') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 409 }
      );
    }
    throw err;
  }
}
