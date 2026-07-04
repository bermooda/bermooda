import { useLoaderData } from 'react-router';

import {
  _registry,
  resolvePluginStorefrontRoute as resolveServerRoute,
} from '#/core/plugins/index.server';
import { resolvePluginStorefrontRoute as resolveClientRoute } from '#/core/plugins/storefront-routes.client';
import { get } from '#/core/settings/index.server';
import { preloadStorefrontTheme } from '#/core/themes/resolve.server';
import StorefrontShell from '#/themes/default/components/storefront-chrome';

function StorefrontMessage({ title, children }) {
  return (
    <StorefrontShell>
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="font-serif text-3xl tracking-tight text-stone-900">
            {title}
          </h1>
          <div className="mt-3 text-sm leading-6 text-stone-600">
            {children}
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

export function meta({ loaderData, params }) {
  const pluginName = loaderData?.manifest?.name ?? params.pluginId;

  return [
    { title: `${pluginName} — Storefront` },
    {
      name: 'description',
      content: `Storefront page for plugin ${pluginName}`,
    },
  ];
}

export async function loader({ request, params }) {
  const themeId = await preloadStorefrontTheme();
  const { pluginId } = params;
  const splatPath = params['*'] ?? '';

  const entry = _registry.get(pluginId);

  if (!entry) {
    return { status: 'not-found', pluginId, themeId };
  }

  const { manifest } = entry;
  const enabledPluginsRaw = await get('enabledPlugins');
  const enabledPlugins = Array.isArray(enabledPluginsRaw)
    ? enabledPluginsRaw
    : [];

  if (!enabledPlugins.includes(pluginId)) {
    return { status: 'disabled', pluginId, manifest, themeId };
  }

  if (!manifest.storefrontRoutes && !resolveServerRoute(pluginId, splatPath)) {
    return { status: 'no-storefront-routes', pluginId, manifest, themeId };
  }

  const descriptor = resolveServerRoute(pluginId, splatPath);

  if (!descriptor) {
    return { status: 'no-match', pluginId, manifest, splatPath, themeId };
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
    themeId,
  };
}

export default function StorefrontPluginDispatcher() {
  const data = useLoaderData();

  if (data.status === 'not-found') {
    return (
      <StorefrontMessage title="Plugin not found">
        No plugin with ID <span className="font-mono">{data.pluginId}</span> is
        registered.
      </StorefrontMessage>
    );
  }

  if (data.status === 'disabled') {
    return (
      <StorefrontMessage title={data.manifest.name}>
        This plugin&apos;s storefront pages are unavailable until the plugin is
        enabled in admin.
      </StorefrontMessage>
    );
  }

  if (data.status === 'no-storefront-routes') {
    return (
      <StorefrontMessage title={data.manifest.name}>
        This plugin has no storefront pages.
      </StorefrontMessage>
    );
  }

  if (data.status === 'no-match') {
    return (
      <StorefrontMessage title={data.manifest.name}>
        This plugin has no storefront page for this path.
      </StorefrontMessage>
    );
  }

  const descriptor = resolveClientRoute(data.pluginId, data.splatPath);
  const PluginComponent = descriptor?.Component;

  if (!PluginComponent) {
    return (
      <StorefrontMessage title={data.manifest.name}>
        This plugin has no storefront page for this path.
      </StorefrontMessage>
    );
  }

  return (
    <StorefrontShell>
      <PluginComponent loaderData={data.pluginLoaderData} />
    </StorefrontShell>
  );
}
