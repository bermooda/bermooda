// GET /api/admin/v1/plugins — list plugins, enabled ids, order, settings
// PATCH /api/admin/v1/plugins — enable/disable, reorder, or save settings
// Requires admin-scoped API key.

import {
  createDomainErrorMapper,
  parseJsonBody,
  requireMethod,
} from '#/libs/api/admin/index.server';
import {
  getRegisteredPlugin,
  listRegisteredPlugins,
  loadAllPluginSettings,
  savePluginSettingsValues,
  setPluginEnabledState,
  setPluginOrder,
  sortPluginsByOrder,
} from '#/core/plugins/index.server';
import { get } from '#/core/settings/index.server';
import { SETTING_KEYS } from '#/core/settings/keys';

const mapPluginError = createDomainErrorMapper({
  notFound: ['PLUGIN_NOT_FOUND'],
  badRequest: ['PLUGIN_INVALID', 'PLUGIN_ORDER_INVALID'],
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
export function serializePluginManifest(manifest) {
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
 * @returns {Promise<object>}
 */
async function loadPluginsPayload() {
  const allPlugins = listRegisteredPlugins();
  const [enabledPluginsRaw, pluginOrderRaw] = await Promise.all([
    get(SETTING_KEYS.ENABLED_PLUGINS),
    get(SETTING_KEYS.PLUGIN_ORDER),
  ]);
  const enabledPlugins = Array.isArray(enabledPluginsRaw)
    ? enabledPluginsRaw
    : [];
  const pluginOrder = Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [];
  const plugins = [...allPlugins]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(serializePluginManifest);
  const orderedPlugins = sortPluginsByOrder(allPlugins, pluginOrder).map(
    serializePluginManifest
  );
  const pluginSettings = await loadAllPluginSettings(allPlugins);

  return {
    plugins,
    orderedPlugins,
    enabledPlugins,
    pluginOrder,
    pluginSettings,
  };
}

export async function loader() {
  const payload = await loadPluginsPayload();
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

  const pluginId = body.pluginId?.toString().trim() || '';
  const hasEnabled = typeof body.enabled === 'boolean';
  const order = Array.isArray(body.order)
    ? body.order.map(String)
    : Array.isArray(body.pluginOrder)
      ? body.pluginOrder.map(String)
      : null;
  const settings =
    body.settings && typeof body.settings === 'object' ? body.settings : null;

  if (!hasEnabled && !order && !settings) {
    return Response.json(
      {
        error:
          'Provide enabled (+ pluginId), order/pluginOrder, and/or settings (+ pluginId)',
        code: 'PLUGIN_INVALID',
      },
      { status: 400 }
    );
  }

  try {
    if (hasEnabled) {
      if (!pluginId) {
        return Response.json(
          {
            error: 'pluginId is required when setting enabled',
            code: 'PLUGIN_INVALID',
          },
          { status: 400 }
        );
      }
      if (!getRegisteredPlugin(pluginId)) {
        return Response.json(
          { error: 'Plugin not found', code: 'PLUGIN_NOT_FOUND' },
          { status: 404 }
        );
      }
      await setPluginEnabledState(pluginId, body.enabled);
    }

    if (order) {
      try {
        await setPluginOrder(order);
      } catch (orderErr) {
        const error = /** @type {Error} */ (orderErr);
        throw Object.assign(
          new Error(error.message || 'Invalid plugin order'),
          {
            code: 'PLUGIN_ORDER_INVALID',
            status: 400,
          }
        );
      }
    }

    if (settings) {
      if (!pluginId) {
        return Response.json(
          {
            error: 'pluginId is required when saving settings',
            code: 'PLUGIN_INVALID',
          },
          { status: 400 }
        );
      }
      const manifest = getRegisteredPlugin(pluginId);
      if (!manifest) {
        return Response.json(
          { error: 'Plugin not found', code: 'PLUGIN_NOT_FOUND' },
          { status: 404 }
        );
      }
      await savePluginSettingsValues(pluginId, manifest, settings);
    }

    const payload = await loadPluginsPayload();
    return Response.json(payload);
  } catch (err) {
    const error = /** @type {Error & { code?: string }} */ (err);
    if (error.message === 'Plugin not found') {
      return Response.json(
        { error: error.message, code: 'PLUGIN_NOT_FOUND' },
        { status: 404 }
      );
    }
    return mapPluginError(error);
  }
}
