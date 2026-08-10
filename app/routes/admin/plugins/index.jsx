// app/routes/admin/plugins/index.jsx
// Admin Plugins page — list registered plugins, enable/disable, reorder.

import { useEffect, useState } from 'react';
import { Form, useFetcher, useLoaderData, useNavigation } from 'react-router';

import { useT } from '#/core/i18n';
import {
  listRegisteredPlugins,
  resolvePluginAdminRoute,
  setPluginEnabledState,
  setPluginOrder,
  sortPluginsByOrder,
} from '#/core/plugins/index.server';
import { get } from '#/core/settings/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import PageHeader from '#/components/admin/page-header';
import SortableList, { SortableGrip } from '#/components/admin/sortable-list';
import Tabs from '#/components/admin/tabs';
import Button from '#/components/ui/button';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function meta() {
  return [
    { title: 'Plugins — Admin' },
    { name: 'description', content: 'Manage storefront plugins' },
  ];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads all registered plugins, the enabled list, and the display order.
 */
export async function loader() {
  const allPlugins = listRegisteredPlugins();
  const [enabledPlugins, pluginOrderRaw] = await Promise.all([
    get('enabledPlugins'),
    get('pluginOrder'),
  ]);
  const enabledPluginIds = Array.isArray(enabledPlugins) ? enabledPlugins : [];
  const pluginOrder = Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [];
  const plugins = [...allPlugins]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((manifest) => ({
      ...manifest,
      hasAdminUi: Boolean(resolvePluginAdminRoute(manifest.slug, '')),
    }));
  const orderedPlugins = sortPluginsByOrder(allPlugins, pluginOrder);

  return {
    plugins,
    orderedPlugins,
    enabledPlugins: enabledPluginIds,
    pluginOrder,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Handles:
 *  - intent=enable  → add pluginId to enabledPlugins
 *  - intent=disable → remove pluginId from enabledPlugins
 *  - intent=reorder → persist plugin block order from drag and drop
 */
export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'enable' || intent === 'disable') {
    const pluginId = formData.get('pluginId');
    if (!pluginId) return { error: 'Missing pluginId' };

    try {
      await setPluginEnabledState(pluginId, intent === 'enable');
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : 'Failed to update plugin state',
      };
    }

    return { success: true, intent };
  }

  if (intent === 'reorder') {
    const orderRaw = formData.get('order')?.toString();
    if (!orderRaw) return { error: 'Missing order' };

    let orderedIds;
    try {
      orderedIds = JSON.parse(orderRaw);
    } catch {
      return { error: 'Invalid order' };
    }

    if (!Array.isArray(orderedIds)) {
      return { error: 'Invalid order' };
    }

    try {
      await setPluginOrder(orderedIds);
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Failed to reorder plugin',
      };
    }

    return { success: true, intent };
  }

  return { error: `Unknown intent: ${intent}` };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Whether a plugin manifest declares an email transport provider.
 *
 * @param {object} manifest
 * @returns {boolean}
 */
function isEmailProviderPlugin(manifest) {
  const providers = manifest?.providers;
  if (!providers || typeof providers !== 'object') return false;
  return Object.values(providers).some(
    (spec) => spec && typeof spec === 'object' && spec.type === 'email'
  );
}

/**
 * A single plugin card.
 *
 * @param {Object} props
 * @param {object} props.manifest
 * @param {boolean} props.isEnabled
 * @param {boolean} [props.isEmailProvider]
 */
function PluginCard({ manifest, isEnabled, isEmailProvider = false }) {
  const t = useT();
  const navigation = useNavigation();

  const isToggling =
    navigation.state === 'submitting' &&
    (navigation.formData?.get('intent') === 'enable' ||
      navigation.formData?.get('intent') === 'disable') &&
    navigation.formData?.get('pluginId') === manifest.id;

  const toggleIntent = isEnabled ? 'disable' : 'enable';
  const enableLabel = isEmailProvider
    ? t('admin.plugins.index.activate')
    : t('admin.plugins.index.enable');
  const disableLabel = isEmailProvider
    ? t('admin.plugins.index.deactivate')
    : t('admin.plugins.index.disable');
  const activeBadge = isEmailProvider
    ? t('admin.plugins.index.badge.active')
    : t('admin.plugins.index.badge.enabled');
  const showSettings =
    Boolean(manifest.settings?.length) || Boolean(manifest.hasAdminUi);

  return (
    <Card
      padded={false}
      className={`flex h-full flex-col p-5${isEnabled ? ' border-accent bg-accent/5' : ''}`}
    >
      {/* Header row */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-text truncate text-sm font-semibold">
            {manifest.title}
          </h3>
          {isEmailProvider && (
            <Badge tone="neutral">{t('admin.plugins.index.badge.email')}</Badge>
          )}
          {isEnabled && <Badge tone="success">{activeBadge}</Badge>}
        </div>
        <p className="text-text-muted mt-0.5 text-xs">
          v{manifest.version} &middot;{' '}
          <span className="font-mono">{manifest.id}</span>
        </p>
        {manifest.description && (
          <p className="text-text-muted mt-1.5 text-sm">
            {manifest.description}
          </p>
        )}
      </div>

      {/* Actions — pinned to card bottom for aligned grid rows */}
      <div className="mt-auto pt-4">
        <div className="border-border flex items-center justify-between gap-2 border-t pt-3">
          <div>
            {showSettings ? (
              <a
                href={`/admin/plugins/${manifest.slug}`}
                className="border-border text-text hover:bg-surface-2 rounded-md border px-3 py-1.5 text-xs font-medium transition"
              >
                {t('admin.plugins.index.settings')}
              </a>
            ) : null}
          </div>
          <Form method="post">
            <input type="hidden" name="intent" value={toggleIntent} />
            <input type="hidden" name="pluginId" value={manifest.id} />
            <Button
              type="submit"
              variant={isEnabled ? 'danger' : 'secondary'}
              disabled={isToggling}
              className="h-9 min-w-[5.25rem] justify-center"
            >
              {isEnabled ? disableLabel : enableLabel}
            </Button>
          </Form>
        </div>
      </div>
    </Card>
  );
}

/**
 * Block order tab — reorder plugins for storefront slot rendering.
 *
 * @param {{ orderedPlugins: object[], enabledPlugins: string[] }} props
 */
function BlockOrderTab({ orderedPlugins, enabledPlugins }) {
  const t = useT();
  const reorderFetcher = useFetcher();
  const [plugins, setPlugins] = useState(orderedPlugins);

  useEffect(() => {
    setPlugins(orderedPlugins);
  }, [orderedPlugins]);

  const isReordering = reorderFetcher.state !== 'idle';

  function persistOrder(nextPlugins) {
    const formData = new FormData();
    formData.set('intent', 'reorder');
    formData.set(
      'order',
      JSON.stringify(nextPlugins.map((plugin) => plugin.id))
    );
    reorderFetcher.submit(formData, { method: 'post' });
  }

  return (
    <div className="space-y-4">
      <p className="text-text-muted text-sm">
        {t('admin.plugins.index.blockOrderHelp')}
      </p>

      {plugins.length === 0 ? (
        <EmptyState
          title={t('admin.plugins.index.emptyTitle')}
          description={t('admin.plugins.index.emptyDescription')}
        />
      ) : (
        <SortableList
          items={plugins}
          getId={(manifest) => manifest.id}
          disabled={isReordering}
          className="space-y-2"
          itemClassName="list-none"
          onReorder={(nextPlugins) => {
            setPlugins(nextPlugins);
            persistOrder(nextPlugins);
          }}
          renderItem={(manifest, _index, { handleRef, isDragging }) => (
            <div
              className={`border-border bg-surface flex items-center gap-3 rounded-lg border px-4 py-3${isDragging || isReordering ? ' opacity-60' : ''}`}
            >
              <SortableGrip
                handleRef={handleRef}
                disabled={isReordering}
                className="shrink-0"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-text truncate text-sm font-medium">
                    {manifest.title}
                  </span>
                  {enabledPlugins.includes(manifest.id) && (
                    <Badge tone="success">
                      {t('admin.plugins.index.badge.enabled')}
                    </Badge>
                  )}
                </div>
                <p className="text-text-muted truncate font-mono text-xs">
                  {manifest.id}
                </p>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}

/**
 * Main plugins tab — enable/disable and open plugin settings.
 *
 * @param {{ plugins: object[], enabledPlugins: string[] }} props
 */
function PluginsTab({ plugins, enabledPlugins }) {
  const t = useT();
  const emailPlugins = plugins.filter(isEmailProviderPlugin);
  const otherPlugins = plugins.filter(
    (manifest) => !isEmailProviderPlugin(manifest)
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-text mb-1 text-lg font-semibold">
          {t('admin.plugins.index.emailProvidersHeading')}
        </h2>
        <p className="text-text-muted mb-3 text-sm">
          {t('admin.plugins.index.emailProvidersHelp')}
        </p>

        {emailPlugins.length === 0 ? (
          <EmptyState
            title={t('admin.plugins.index.noEmailProvidersTitle')}
            description={t('admin.plugins.index.noEmailProvidersDescription')}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {emailPlugins.map((manifest) => (
              <PluginCard
                key={manifest.id}
                manifest={manifest}
                isEnabled={enabledPlugins.includes(manifest.id)}
                isEmailProvider
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-text mb-3 text-lg font-semibold">
          {t('admin.plugins.index.otherPluginsHeading')}
        </h2>

        {otherPlugins.length === 0 ? (
          <EmptyState
            title={t('admin.plugins.index.noOtherPluginsTitle')}
            description={t('admin.plugins.index.noOtherPluginsDescription')}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherPlugins.map((manifest) => (
              <PluginCard
                key={manifest.id}
                manifest={manifest}
                isEnabled={enabledPlugins.includes(manifest.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

/**
 * Admin Plugins Route
 *
 * @returns {React.ReactElement}
 */
export default function AdminPluginsRoute() {
  const t = useT();
  const { plugins, orderedPlugins, enabledPlugins } = useLoaderData();
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    t('admin.plugins.index.tab.plugins'),
    t('admin.plugins.index.tab.blockOrder'),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('admin.plugins.index.title')}
        subtitle={t('admin.plugins.index.subtitle')}
      />

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 0 && (
        <PluginsTab plugins={plugins} enabledPlugins={enabledPlugins} />
      )}
      {activeTab === 1 && (
        <BlockOrderTab
          orderedPlugins={orderedPlugins}
          enabledPlugins={enabledPlugins}
        />
      )}
    </div>
  );
}
