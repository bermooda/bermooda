// app/routes/admin/plugins/$pluginId.jsx
// Plugin admin dispatcher — resolves admin UI for a specific plugin.

import { useLoaderData } from 'react-router';

import { _registry, resolvePluginRoute } from '#/core/plugins/index.server';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function meta({ params }) {
  return [
    { title: `Plugin: ${params.pluginId} — Admin` },
    { name: 'description', content: `Admin UI for plugin ${params.pluginId}` },
  ];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Resolves the plugin manifest and the matched route descriptor for the
 * current splat path. Returns enough data for the component to decide what
 * to render without throwing HTTP errors (all states are rendered inline).
 */
export async function loader({ params }) {
  const { pluginId } = params;
  const splatPath = params['*'] ?? '';

  const entry = _registry.get(pluginId);

  if (!entry) {
    return { status: 'not-found', pluginId };
  }

  const { manifest } = entry;

  if (!manifest.adminRoutes) {
    return { status: 'no-admin-routes', pluginId, manifest };
  }

  const descriptor = resolvePluginRoute(pluginId, splatPath);

  if (!descriptor) {
    return { status: 'no-match', pluginId, manifest, splatPath };
  }

  return { status: 'ok', pluginId, manifest, descriptor, splatPath };
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

/**
 * Renders the appropriate content based on the loader result:
 * - not-found          → "Plugin not found" message
 * - no-admin-routes    → "This plugin has no admin pages"
 * - no-match           → "This plugin has no admin pages for this path"
 * - ok                 → rendered plugin admin component
 *
 * @returns {React.ReactElement}
 */
export default function AdminPluginDispatcher() {
  const data = useLoaderData();

  if (data.status === 'not-found') {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Plugin not found
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No plugin with ID{' '}
          <span className="font-mono">{data.pluginId}</span> is registered.
        </p>
      </div>
    );
  }

  if (data.status === 'no-admin-routes') {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {data.manifest.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This plugin has no admin pages.
        </p>
      </div>
    );
  }

  if (data.status === 'no-match') {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {data.manifest.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This plugin has no admin pages for this path.
        </p>
      </div>
    );
  }

  // status === 'ok': descriptor resolved — render the plugin's admin component.
  const { descriptor, manifest } = data;
  const PluginComponent = descriptor?.component;

  if (!PluginComponent) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {manifest.name}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This plugin has no admin pages for this path.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PluginComponent />
    </div>
  );
}
