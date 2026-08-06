// app/routes/admin/plugins/$pluginId.jsx
// Plugin admin dispatcher — resolves admin UI for a specific plugin.

import { useLoaderData } from 'react-router';

import { useT } from '#/core/i18n';
import { resolvePluginAdminRoute } from '#/core/plugins/admin-routes.client';
import {
  getRegisteredPluginBySlug,
  resolvePluginAdminRoute as resolveAdminRoute,
} from '#/core/plugins/index.server';
import Breadcrumbs from '#/components/admin/breadcrumbs';
import PageHeader from '#/components/admin/page-header';

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
  };
}

/**
 * Dispatches POST/mutations to the matched plugin admin route `action`.
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
    <div>
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

  const descriptor = resolvePluginAdminRoute(data.pluginId, data.splatPath);
  const PluginComponent = descriptor?.Component;

  if (!PluginComponent) {
    return (
      <PluginHostChrome
        title={data.manifest.title}
        subtitle={t('admin.plugins.detail.noAdminPagesForPath')}
      />
    );
  }

  return (
    <div>
      <PluginComponent loaderData={data.pluginLoaderData} />
    </div>
  );
}
