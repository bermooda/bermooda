import { useLoaderData } from 'react-router';

import {
  getRegisteredPluginBySlug,
  isPluginEnabled,
  resolvePluginStorefrontRoute as resolveServerRoute,
} from '#/core/plugins/index.server';
import { resolvePluginStorefrontRoute as resolveClientRoute } from '#/core/plugins/storefront-routes.client';
import { loadStorefrontPageContext } from '#/core/storefront/page-context.server';
import { getStorefrontComponent } from '#/core/themes/storefront-components';

/**
 * @param {{ title: string, children: React.ReactNode, themeId?: string }} props
 */
function StorefrontMessage({ title, children, themeId }) {
  // Plugin error/status pages wrap Layout themselves (outside storefront chrome).
  const Layout = getStorefrontComponent('Layout', themeId);
  const inner = (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl tracking-tight text-stone-900">
          {title}
        </h1>
        <div className="mt-3 text-sm leading-6 text-stone-600">{children}</div>
      </div>
    </div>
  );
  if (!Layout) return inner;
  return <Layout>{inner}</Layout>;
}

/**
 * @param {{ loaderData?: { manifest?: { title?: string } } | null, params: { pluginId?: string } }} args
 * @returns {Array<{ title: string } | { name: string, content: string }>}
 */
export function meta({ loaderData, params }) {
  const pluginTitle = loaderData?.manifest?.title ?? params.pluginId;

  return [
    { title: `${pluginTitle} — Storefront` },
    {
      name: 'description',
      content: `Storefront page for plugin ${pluginTitle}`,
    },
  ];
}

/**
 * @param {{ request: Request, params: Record<string, string | undefined> }} args
 */
export async function loader({ request, params }) {
  const { themeId } = await loadStorefrontPageContext(request);
  const pluginSlug = params.pluginId ?? '';
  const splatPath = params['*'] ?? '';

  const manifest = getRegisteredPluginBySlug(pluginSlug);

  if (!manifest) {
    return { status: 'not-found', pluginId: pluginSlug, themeId };
  }

  if (!(await isPluginEnabled(manifest.id))) {
    return { status: 'disabled', pluginId: pluginSlug, manifest, themeId };
  }

  const rootDescriptor = resolveServerRoute(pluginSlug, '');
  const descriptor = resolveServerRoute(pluginSlug, splatPath);

  if (!rootDescriptor && !descriptor) {
    return {
      status: 'no-storefront-routes',
      pluginId: pluginSlug,
      manifest,
      themeId,
    };
  }

  if (!descriptor) {
    return {
      status: 'no-match',
      pluginId: pluginSlug,
      manifest,
      splatPath,
      themeId,
    };
  }

  let pluginLoaderData = null;
  if (typeof descriptor.loader === 'function') {
    pluginLoaderData = await descriptor.loader({
      request,
      params: { ...params, ...descriptor.params },
    });
  }

  return {
    status: 'ok',
    pluginId: pluginSlug,
    manifest,
    splatPath,
    pluginLoaderData,
    themeId,
  };
}

/**
 * Dispatches POST/mutations to the matched plugin storefront route `action`.
 *
 * @param {{ request: Request, params: Record<string, string | undefined> }} args
 * @returns {Promise<unknown>}
 */
export async function action({ request, params }) {
  const pluginSlug = params.pluginId ?? '';
  const splatPath = params['*'] ?? '';
  const manifest = getRegisteredPluginBySlug(pluginSlug);
  if (!manifest || !(await isPluginEnabled(manifest.id))) {
    throw new Response('Not Found', { status: 404 });
  }
  const descriptor = resolveServerRoute(pluginSlug, splatPath);
  if (!descriptor || typeof descriptor.action !== 'function') {
    throw new Response('Method Not Allowed', { status: 405 });
  }
  return descriptor.action({
    request,
    params: { ...params, ...descriptor.params },
  });
}

/**
 * @returns {React.ReactElement}
 */
export default function StorefrontPluginDispatcher() {
  const data = useLoaderData();
  const themeId = data.themeId;

  if (data.status === 'not-found') {
    return (
      <StorefrontMessage title="Plugin not found" themeId={themeId}>
        No plugin with ID <span className="font-mono">{data.pluginId}</span> is
        registered.
      </StorefrontMessage>
    );
  }

  if (data.status === 'disabled') {
    return (
      <StorefrontMessage title={data.manifest.title} themeId={themeId}>
        This plugin&apos;s storefront pages are unavailable until the plugin is
        enabled in admin.
      </StorefrontMessage>
    );
  }

  if (data.status === 'no-storefront-routes') {
    return (
      <StorefrontMessage title={data.manifest.title} themeId={themeId}>
        This plugin has no storefront pages.
      </StorefrontMessage>
    );
  }

  if (data.status === 'no-match') {
    return (
      <StorefrontMessage title={data.manifest.title} themeId={themeId}>
        This plugin has no storefront page for this path.
      </StorefrontMessage>
    );
  }

  const descriptor = resolveClientRoute(data.pluginId, data.splatPath);
  const PluginComponent = descriptor?.Component;

  if (!PluginComponent) {
    return (
      <StorefrontMessage title={data.manifest.title} themeId={themeId}>
        This plugin has no storefront page for this path.
      </StorefrontMessage>
    );
  }

  const Layout = getStorefrontComponent('Layout', themeId);
  if (!Layout) return <PluginComponent loaderData={data.pluginLoaderData} />;
  // Matched plugin pages wrap Layout themselves (same pattern as status states).
  return (
    <Layout>
      <PluginComponent loaderData={data.pluginLoaderData} />
    </Layout>
  );
}
