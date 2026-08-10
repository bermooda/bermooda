// app/routes/admin/plugins/$pluginId.jsx
// Plugin admin dispatcher — resolves admin UI for a specific plugin.

import { useLoaderData } from 'react-router';

import { useT } from '#/core/i18n';
import { resolvePluginAdminRoute } from '#/core/plugins/admin-routes.client';
import {
  getRegisteredPluginBySlug,
  loadPluginSettings,
  resolvePluginAdminRoute as resolveAdminRoute,
  savePluginSettings,
} from '#/core/plugins/index.server';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import PageHeader from '#/components/admin/page-header';
import PluginSettingsForm from '#/components/admin/plugin-settings-form';

/**
 * @param {{ params: { pluginId?: string } }} args
 * @returns {Array<{ title: string } | { name: string, content: string }>}
 */
export function meta({ params }) {
  return [
    { title: `Plugin: ${params.pluginId} — Admin` },
    { name: 'description', content: `Admin UI for plugin ${params.pluginId}` },
  ];
}

/**
 * @param {{ params: Record<string, string | undefined>, request: Request }} args
 * @returns {Promise<
 *   | { status: 'not-found', pluginId: string }
 *   | { status: 'no-admin-routes', pluginId: string, manifest: import('#/core/plugins/registry.server').PluginManifest }
 *   | { status: 'no-match', pluginId: string, manifest: import('#/core/plugins/registry.server').PluginManifest, splatPath: string }
 *   | { status: 'ok', pluginId: string, manifest: import('#/core/plugins/registry.server').PluginManifest, splatPath: string, pluginLoaderData: unknown, pluginSettings: Record<string, string> }
 * >} Settings-only plugins (settings schema, no admin routes) resolve as `ok` on
 * the root path with `pluginSettings` loaded and `pluginLoaderData` null.
 */
export async function loader({ params, request }) {
  const pluginSlug = params.pluginId ?? '';
  const splatPath = params['*'] ?? '';

  const manifest = getRegisteredPluginBySlug(pluginSlug);

  if (!manifest) {
    return { status: 'not-found', pluginId: pluginSlug };
  }

  const rootDescriptor = resolveAdminRoute(pluginSlug, '');
  const descriptor = resolveAdminRoute(pluginSlug, splatPath);
  const hasSettings = Boolean(manifest.settings?.length);
  const isRoot = splatPath === '';

  if (!rootDescriptor && !descriptor && !(hasSettings && isRoot)) {
    return { status: 'no-admin-routes', pluginId: pluginSlug, manifest };
  }

  if (!descriptor && !(hasSettings && isRoot)) {
    return { status: 'no-match', pluginId: pluginSlug, manifest, splatPath };
  }

  let pluginLoaderData = null;
  if (descriptor && typeof descriptor.loader === 'function') {
    pluginLoaderData = await descriptor.loader({
      request,
      params: { ...params, ...descriptor.params },
    });
  }

  const pluginSettings =
    hasSettings && isRoot ? await loadPluginSettings(manifest) : {};

  return {
    status: 'ok',
    pluginId: pluginSlug,
    manifest,
    splatPath,
    pluginLoaderData,
    pluginSettings,
  };
}

/**
 * Dispatches POST/mutations to the matched plugin admin route `action`,
 * or handles core `save-settings` intent for plugin config forms.
 * Matches loader policy: requires a registered plugin; does not check enabled.
 *
 * @param {{ request: Request, params: Record<string, string | undefined> }} args
 * @returns {Promise<unknown>}
 */
export async function action({ request, params }) {
  const pluginSlug = params.pluginId ?? '';
  const splatPath = params['*'] ?? '';
  const manifest = getRegisteredPluginBySlug(pluginSlug);
  if (!manifest) {
    throw new Response('Not Found', { status: 404 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.clone().formData();
    if (formData.get('intent') === 'save-settings') {
      const pluginId = formData.get('pluginId');
      if (!pluginId || pluginId !== manifest.id) {
        return { error: 'Missing pluginId', intent: 'save-settings' };
      }
      if (!manifest.settings?.length) {
        return { error: 'No settings for plugin', intent: 'save-settings' };
      }
      try {
        await savePluginSettings(manifest.id, manifest, formData);
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'Failed to save settings',
          intent: 'save-settings',
        };
      }
      return {
        success: true,
        intent: 'save-settings',
        savedSettings: manifest.id,
      };
    }
  }

  const descriptor = resolveAdminRoute(pluginSlug, splatPath);
  if (!descriptor || typeof descriptor.action !== 'function') {
    throw new Response('Method Not Allowed', { status: 405 });
  }
  return descriptor.action({
    request,
    params: { ...params, ...descriptor.params },
  });
}

/**
 * Error / empty chrome for plugin host states (not-found, no admin routes).
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.subtitle
 * @returns {React.ReactElement}
 */
function PluginHostChrome({ title, subtitle }) {
  const t = useT();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: t('admin.plugins.index.title'), href: '/admin/plugins' },
              { label: title },
            ]}
          />
        }
        title={title}
        subtitle={subtitle}
      />
    </div>
  );
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminPluginDispatcher() {
  const t = useT();
  const data = useLoaderData();

  if (data.status === 'not-found') {
    return (
      <PluginHostChrome
        title={t('admin.plugins.detail.notFoundTitle')}
        subtitle={t('admin.plugins.detail.notFoundDescription', {
          id: data.pluginId,
        })}
      />
    );
  }

  if (data.status === 'no-admin-routes') {
    return (
      <PluginHostChrome
        title={data.manifest.title}
        subtitle={t('admin.plugins.detail.noAdminPages')}
      />
    );
  }

  if (data.status === 'no-match') {
    return (
      <PluginHostChrome
        title={data.manifest.title}
        subtitle={t('admin.plugins.detail.noAdminPagesForPath')}
      />
    );
  }

  const isRoot = data.splatPath === '';
  const hasSettings = Boolean(data.manifest.settings?.length);
  const descriptor = resolvePluginAdminRoute(data.pluginId, data.splatPath);
  const PluginComponent = descriptor?.Component;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        sticky
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: t('admin.plugins.index.title'),
                href: '/admin/plugins',
              },
              { label: data.manifest.title },
            ]}
          />
        }
        title={data.manifest.title}
        subtitle={`v${data.manifest.version} · ${data.manifest.id}`}
      />

      {isRoot && hasSettings ? (
        <PluginSettingsForm
          manifest={data.manifest}
          values={data.pluginSettings ?? {}}
        />
      ) : null}

      {PluginComponent ? (
        <PluginComponent loaderData={data.pluginLoaderData} />
      ) : null}

      {!PluginComponent && !(isRoot && hasSettings) ? (
        <p className="text-text-muted text-sm">
          {t('admin.plugins.detail.noAdminPagesForPath')}
        </p>
      ) : null}
    </div>
  );
}
