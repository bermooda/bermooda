// app/routes/admin/plugins/$pluginId.jsx
// Plugin admin dispatcher — resolves admin UI for a specific plugin.

import { useLoaderData } from 'react-router';

import { resolvePluginAdminRoute } from '#/core/plugins/admin-routes.client';
import {
  getRegisteredPluginBySlug,
  resolvePluginAdminRoute as resolveAdminRoute,
} from '#/core/plugins/index.server';

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

  if (!rootDescriptor && !descriptor) {
    return { status: 'no-admin-routes', pluginId: pluginSlug, manifest };
  }

  if (!descriptor) {
    return { status: 'no-match', pluginId: pluginSlug, manifest, splatPath };
  }

  let pluginLoaderData = null;
  if (typeof descriptor.loader === 'function') {
    pluginLoaderData = await descriptor.loader({ request, params });
  }

  return {
    status: 'ok',
    pluginId: pluginSlug,
    manifest,
    splatPath,
    pluginLoaderData,
  };
}

/**
 * @returns {React.ReactElement}
 */
export default function AdminPluginDispatcher() {
  const data = useLoaderData();

  if (data.status === 'not-found') {
    return (
      <div className="space-y-2">
        <h1 className="text-text text-2xl font-bold">Plugin not found</h1>
        <p className="text-text-muted text-sm">
          No plugin with ID <span className="font-mono">{data.pluginId}</span>{' '}
          is registered.
        </p>
      </div>
    );
  }

  if (data.status === 'no-admin-routes') {
    return (
      <div className="space-y-2">
        <h1 className="text-text text-2xl font-bold">{data.manifest.title}</h1>
        <p className="text-text-muted text-sm">
          This plugin has no admin pages.
        </p>
      </div>
    );
  }

  if (data.status === 'no-match') {
    return (
      <div className="space-y-2">
        <h1 className="text-text text-2xl font-bold">{data.manifest.title}</h1>
        <p className="text-text-muted text-sm">
          This plugin has no admin pages for this path.
        </p>
      </div>
    );
  }

  const descriptor = resolvePluginAdminRoute(data.pluginId, data.splatPath);
  const PluginComponent = descriptor?.Component;

  if (!PluginComponent) {
    return (
      <div className="space-y-2">
        <h1 className="text-text text-2xl font-bold">{data.manifest.title}</h1>
        <p className="text-text-muted text-sm">
          This plugin has no admin pages for this path.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PluginComponent loaderData={data.pluginLoaderData} />
    </div>
  );
}
