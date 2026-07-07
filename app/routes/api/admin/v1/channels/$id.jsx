// GET /api/admin/v1/channels/:id — get sales channel
// PATCH /api/admin/v1/channels/:id — update sales channel
// Requires admin-scoped API key.

import { requireApiKey } from '#/libs/auth/api.server';
import {
  getChannel,
  serializeChannel,
  setChannelPriceOverride,
  setChannelProductPublished,
  updateChannel,
} from '#/core/channels/index.server';

export async function loader({ request, params }) {
  await requireApiKey(request, ['admin']);

  try {
    const channel = await getChannel(params.id);
    return Response.json({ channel: serializeChannel(channel) });
  } catch (err) {
    if (err.code === 'CHANNEL_NOT_FOUND') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 404 }
      );
    }
    throw err;
  }
}

export async function action({ request, params }) {
  await requireApiKey(request, ['admin']);

  if (request.method !== 'PATCH') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (body.priceOverride) {
      await setChannelPriceOverride({
        channelId: params.id,
        ...body.priceOverride,
      });
    }

    if (body.productPublished) {
      const { productId, published } = body.productPublished;
      await setChannelProductPublished(
        params.id,
        productId?.toString(),
        published === true || published === 'true'
      );
    }

    const hasChannelUpdates =
      body.name !== undefined ||
      body.handle !== undefined ||
      body.domain !== undefined ||
      body.currency !== undefined ||
      body.locale !== undefined ||
      body.active !== undefined ||
      body.isDefault !== undefined;

    if (hasChannelUpdates) {
      await updateChannel(params.id, body);
    }

    const channel = await getChannel(params.id);
    return Response.json({ channel: serializeChannel(channel) });
  } catch (err) {
    if (err.code === 'CHANNEL_NOT_FOUND') {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 404 }
      );
    }
    if (
      err.code === 'NAME_REQUIRED' ||
      err.code === 'HANDLE_REQUIRED' ||
      err.code === 'HANDLE_INVALID' ||
      err.code === 'CURRENCY_INVALID' ||
      err.code === 'LOCALE_INVALID' ||
      err.code === 'CHANNEL_REQUIRED' ||
      err.code === 'VARIANT_REQUIRED' ||
      err.code === 'PRICE_INVALID'
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
