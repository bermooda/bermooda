import { parseJsonBody, requireMethod } from '#/libs/api/admin.server';
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
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

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
