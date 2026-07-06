import { requireApiKey } from '#/libs/auth/api.server';
import {
  applyAdminSettingsPatch,
  getAdminSettingsSnapshot,
  parseAdminSettingsPatch,
} from '#/core/settings/index.server';

export async function loader({ request }) {
  await requireApiKey(request, ['admin']);

  const settings = await getAdminSettingsSnapshot();
  return Response.json({ settings });
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

  const patch = parseAdminSettingsPatch(body);
  if (!patch) {
    return Response.json(
      { error: 'No valid settings section provided' },
      { status: 400 }
    );
  }

  await applyAdminSettingsPatch(patch);
  const settings = await getAdminSettingsSnapshot();
  return Response.json({ settings });
}
