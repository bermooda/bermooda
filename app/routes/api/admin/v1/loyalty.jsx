import {
  getLoyaltyConfig,
  parseLoyaltySettingsInput,
  updateLoyaltySettings,
} from '#/core/loyalty/index.server';

export async function loader() {
  const config = await getLoyaltyConfig();
  return Response.json({ config });
}

export async function action({ request }) {
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
