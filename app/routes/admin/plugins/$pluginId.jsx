// app/routes/admin/plugins/$pluginId.jsx
// Plugin admin dispatcher — resolves admin UI for a specific plugin.

import { useLoaderData } from 'react-router';

import { resolvePluginAdminRoute } from '#/core/plugins/admin-routes.client';
import {
  getRegisteredPlugin,
  resolvePluginAdminRoute as resolveAdminRoute,
} from '#/core/plugins/index.server';

export function meta({ params }) {
  return [
    { title: `Plugin: ${params.pluginId} — Admin` },
    { name: 'description', content: `Admin UI for plugin ${params.pluginId}` },
  ];
}

export async function loader({ params, request }) {
  const { pluginId } = params;
  const splatPath = params['*'] ?? '';

  const manifest = getRegisteredPlugin(pluginId);

  if (!manifest) {
    return { status: 'not-found', pluginId };
  }

  if (!manifest.adminRoutes && !resolveAdminRoute(pluginId, splatPath)) {
    return { status: 'no-admin-routes', pluginId, manifest };
  }

  const descriptor = resolveAdminRoute(pluginId, splatPath);

  if (!descriptor) {
    return { status: 'no-match', pluginId, manifest, splatPath };
  }

  let pluginLoaderData = null;
  if (typeof descriptor.loader === 'function') {
    pluginLoaderData = await descriptor.loader({ request, params });
  }

  return {
    status: 'ok',
    pluginId,
    manifest,
    splatPath,
    pluginLoaderData,
  };
}

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
        <h1 className="text-text text-2xl font-bold">{data.manifest.name}</h1>
        <p className="text-text-muted text-sm">
          This plugin has no admin pages.
        </p>
      </div>
    );
  }

  if (data.status === 'no-match') {
    return (
      <div className="space-y-2">
        <h1 className="text-text text-2xl font-bold">{data.manifest.name}</h1>
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
        <h1 className="text-text text-2xl font-bold">{data.manifest.name}</h1>
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
