import { requireApiKey } from '#/libs/auth/api.server';
import {
  getLoyaltyConfig,
  parseLoyaltySettingsInput,
  updateLoyaltySettings,
} from '#/core/loyalty/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const config = await getLoyaltyConfig();
  return Response.json({ config });
}

export async function action({ request }) {
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

  const settings = parseLoyaltySettingsInput(body);
  if (Object.keys(settings).length === 0) {
    return Response.json(
      { error: 'No valid settings provided' },
      { status: 400 }
    );
  }

  await updateLoyaltySettings(settings);
  const config = await getLoyaltyConfig();
  return Response.json({ config });
}
