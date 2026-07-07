// GET /api/admin/v1/channels/:id — get sales channel
// PATCH /api/admin/v1/channels/:id — update sales channel
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin.server';
import {
  getChannel,
  serializeChannel,
  setChannelPriceOverride,
  setChannelProductPublished,
  updateChannel,
} from '#/core/channels/index.server';

const mapChannelError = createDomainErrorMapper({
  notFound: ['CHANNEL_NOT_FOUND'],
  badRequest: [
    'NAME_REQUIRED',
    'HANDLE_REQUIRED',
    'HANDLE_INVALID',
    'CURRENCY_INVALID',
    'LOCALE_INVALID',
    'CHANNEL_REQUIRED',
    'VARIANT_REQUIRED',
    'PRICE_INVALID',
  ],
  conflict: ['CHANNEL_CONFLICT'],
});

export async function loader({ params }) {
  try {
    const channel = await getChannel(params.id);
    return Response.json({ channel: serializeChannel(channel) });
  } catch (err) {
    return mapChannelError(err);
  }
}

export async function action({ request, params }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

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
    return mapChannelError(err);
  }
}
