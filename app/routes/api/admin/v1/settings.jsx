import { parseJsonBody, requireMethod } from '#/libs/api/admin/index.server';
import {
  applyAdminSettingsPatch,
  getAdminSettingsSnapshot,
  parseAdminSettingsPatch,
} from '#/core/settings/index.server';

export async function loader() {
  const settings = await getAdminSettingsSnapshot();
  return Response.json({ settings });
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

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
