// GET /api/admin/v1/themes — list registered themes + active theme id
// PATCH /api/admin/v1/themes — activate a theme and/or save theme settings
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import { get } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';
import {
  getRegisteredTheme,
  listRegisteredThemes,
  loadThemeSettings,
  resolveActiveTheme,
  saveThemeSettingsValues,
  setActiveTheme,
} from '#/core/themes/index.server';

const mapThemeError = createDomainErrorMapper({
  notFound: ['THEME_NOT_FOUND'],
  badRequest: ['THEME_INVALID', 'THEME_SETTINGS_INVALID'],
});

/**
 * @param {{
 *   id: string,
 *   slug: string,
 *   title: string,
 *   version: string,
 *   description?: string,
 *   settings?: object[],
 * }} manifest
 * @returns {{
 *   id: string,
 *   slug: string,
 *   title: string,
 *   version: string,
 *   description: string|null,
 *   settings: object[],
 * }}
 */
export function serializeThemeManifest(manifest) {
  return {
    id: manifest.id,
    slug: manifest.slug,
    title: manifest.title,
    version: manifest.version,
    description: manifest.description ?? null,
    settings: Array.isArray(manifest.settings) ? manifest.settings : [],
  };
}

/**
 * @returns {Promise<{ themes: object[], activeThemeId: string|null, activeTheme: object|null, themeSettings: Record<string, unknown> }>}
 */
async function loadThemesPayload() {
  const [themes, activeThemeRaw, activeTheme] = await Promise.all([
    Promise.resolve(listRegisteredThemes()),
    get(SETTING_KEYS.ACTIVE_THEME),
    resolveActiveTheme(),
  ]);
  const activeThemeId =
    typeof activeThemeRaw === 'string' ? activeThemeRaw : null;
  const themeSettings = await loadThemeSettings(activeTheme);

  return {
    themes: themes.map(serializeThemeManifest),
    activeThemeId,
    activeTheme: activeTheme ? serializeThemeManifest(activeTheme) : null,
    themeSettings,
  };
}

export async function loader() {
  const payload = await loadThemesPayload();
  return Response.json(payload);
}

export async function action({ request }) {
  const methodError = requireMethod(request, 'PATCH');
  if (methodError) return methodError;

  const parsed = await parseJsonBody(request, {
    invalidMessage: 'Invalid JSON',
  });
  if (parsed.error) return parsed.error;
  const body = parsed.body;

  const themeId =
    body.themeId?.toString().trim() ||
    body.activeThemeId?.toString().trim() ||
    '';
  const settings =
    body.settings && typeof body.settings === 'object' ? body.settings : null;

  if (!themeId && !settings) {
    return Response.json(
      {
        error: 'Provide themeId to activate and/or settings to save',
        code: 'THEME_INVALID',
      },
      { status: 400 }
    );
  }

  try {
    if (themeId) {
      if (!getRegisteredTheme(themeId)) {
        return Response.json(
          { error: 'Theme not found', code: 'THEME_NOT_FOUND' },
          { status: 404 }
        );
      }
      await setActiveTheme(themeId);
    }

    if (settings) {
      const active = await resolveActiveTheme();
      if (!active) {
        return Response.json(
          {
            error: 'No active theme to update settings for',
            code: 'THEME_NOT_FOUND',
          },
          { status: 404 }
        );
      }
      await saveThemeSettingsValues(active.id, active, settings);
    }

    const payload = await loadThemesPayload();
    return Response.json(payload);
  } catch (err) {
    return mapThemeError(err);
  }
}
