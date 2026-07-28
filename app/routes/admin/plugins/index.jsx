// app/routes/admin/plugins/index.jsx
// Admin Plugins page — list registered plugins, enable/disable, reorder, settings.

import { useEffect, useRef, useState } from 'react';
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from 'react-router';

import {
  LEGACY_PLUGIN_ID_MAP,
  normalizeLegacyIds,
} from '#/core/extensions/package-meta';
import {
  getRegisteredPlugin,
  listRegisteredPlugins,
  loadAllPluginSettings,
  savePluginSettings,
  setPluginEnabledState,
  setPluginOrder,
  sortPluginsByOrder,
} from '#/core/plugins/index.server';
import { get } from '#/core/settings/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import SortableList, { SortableGrip } from '#/components/admin/sortable-list';
import Tabs from '#/components/admin/tabs';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

const TABS = ['Plugins', 'Block order'];

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
 * Loads all registered plugins, the enabled list, the display order,
 * and any per-plugin setting values.
 */
export async function loader() {
  const allPlugins = listRegisteredPlugins();
  const [enabledPlugins, pluginOrderRaw] = await Promise.all([
    get('enabledPlugins'),
    get('pluginOrder'),
  ]);
  const enabledPluginIds = normalizeLegacyIds(
    Array.isArray(enabledPlugins) ? enabledPlugins : [],
    LEGACY_PLUGIN_ID_MAP
  );
  const pluginOrder = normalizeLegacyIds(
    Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [],
    LEGACY_PLUGIN_ID_MAP
  );
  const plugins = [...allPlugins].sort((a, b) =>
    a.title.localeCompare(b.title)
  );
  const orderedPlugins = sortPluginsByOrder(allPlugins, pluginOrder);
  const pluginSettings = await loadAllPluginSettings(allPlugins);

  return {
    plugins,
    orderedPlugins,
    enabledPlugins: enabledPluginIds,
    pluginOrder,
    pluginSettings,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Handles:
 *  - intent=enable        → add pluginId to enabledPlugins
 *  - intent=disable       → remove pluginId from enabledPlugins
 *  - intent=reorder       → persist plugin block order from drag and drop
 *  - intent=save-settings → persist per-plugin setting values
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

  if (intent === 'save-settings') {
    const pluginId = formData.get('pluginId');
    if (!pluginId) return { error: 'Missing pluginId' };

    const manifest = getRegisteredPlugin(pluginId);
    if (!manifest) return { error: 'Plugin not found' };

    try {
      await savePluginSettings(pluginId, manifest, formData);
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Failed to save settings',
      };
    }

    return { success: true, intent, savedSettings: pluginId };
  }

  return { error: `Unknown intent: ${intent}` };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Renders a single setting field based on its type.
 *
 * @param {{ setting: object, value: any }} props
 */
function SettingField({ setting, value }) {
  const { key, label, type, options } = setting;
  const id = `setting-${key}`;

  if (type === 'text') {
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Input id={id} type="text" name={key} defaultValue={value} />
      </Field>
    );
  }

  if (type === 'password') {
    const configured = value === '••••••••';
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Input
          id={id}
          type="password"
          name={key}
          defaultValue=""
          autoComplete="off"
          placeholder={
            configured ? '•••••••• (saved — leave blank to keep)' : undefined
          }
        />
      </Field>
    );
  }

  if (type === 'select') {
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Select id={id} name={key} defaultValue={value}>
          {(options ?? []).map((opt) => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </Select>
      </Field>
    );
  }

  if (type === 'toggle') {
    return (
      <label className="flex cursor-pointer items-center gap-3">
        <div className="relative">
          <input
            id={id}
            type="checkbox"
            name={key}
            defaultChecked={value === true || value === 'true'}
            className="peer sr-only"
          />
          <div className="bg-surface-2 peer-checked:bg-accent h-5 w-9 rounded-full" />
          <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
        </div>
        <span className="text-text text-sm font-medium">{label ?? key}</span>
      </label>
    );
  }

  return null;
}

/**
 * Manifest-driven settings form for a plugin.
 *
 * @param {{ manifest: object, values: object }} props
 */
function PluginSettingsForm({ manifest, values }) {
  const actionData = useActionData();
  const formRef = useRef(null);

  const savedThisPlugin = actionData?.savedSettings === manifest.id;

  if (!manifest.settings?.length) return null;

  return (
    <div className="border-border bg-surface-2 mt-4 rounded-lg border">
      <div className="border-border border-b px-4 py-3">
        <h4 className="text-text text-sm font-semibold">Plugin Settings</h4>
      </div>

      <Form ref={formRef} method="post" className="px-4 py-4">
        <input type="hidden" name="intent" value="save-settings" />
        <input type="hidden" name="pluginId" value={manifest.id} />

        <div className="space-y-4">
          {manifest.settings.map((setting) => (
            <SettingField
              key={setting.key}
              setting={setting}
              value={values[setting.key] ?? setting.default ?? ''}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {savedThisPlugin ? (
            <SuccessAlert message="Settings saved." />
          ) : actionData?.error ? (
            <ErrorAlert message={actionData.error} />
          ) : (
            <span />
          )}
          <ButtonSubmit>Save Settings</ButtonSubmit>
        </div>
      </Form>
    </div>
  );
}

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
 * @param {object} props.pluginSettings
 * @param {boolean} [props.isEmailProvider]
 */
function PluginCard({
  manifest,
  isEnabled,
  pluginSettings,
  isEmailProvider = false,
}) {
  const navigation = useNavigation();

  const isToggling =
    navigation.state === 'submitting' &&
    (navigation.formData?.get('intent') === 'enable' ||
      navigation.formData?.get('intent') === 'disable') &&
    navigation.formData?.get('pluginId') === manifest.id;

  const toggleIntent = isEnabled ? 'disable' : 'enable';
  const values = pluginSettings[manifest.id] ?? {};
  const enableLabel = isEmailProvider ? 'Activate' : 'Enable';
  const disableLabel = isEmailProvider ? 'Deactivate' : 'Disable';
  const activeBadge = isEmailProvider ? 'Active' : 'Enabled';

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
          {isEmailProvider && <Badge tone="neutral">Email</Badge>}
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

      {/* Manifest-driven settings form */}
      {manifest.settings?.length > 0 && (
        <PluginSettingsForm manifest={manifest} values={values} />
      )}

      {/* Actions — pinned to card bottom for aligned grid rows */}
      <div className="mt-auto pt-4">
        <div className="border-border flex items-center justify-between gap-2 border-t pt-3">
          <div>
            <a
              href={`/admin/plugins/${manifest.slug}`}
              className="border-border text-text hover:bg-surface-2 rounded-md border px-3 py-1.5 text-xs font-medium transition"
            >
              Plugin Admin &rarr;
            </a>
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
        This order controls how plugin blocks are rendered in storefront slots
        (for example on product pages, cart, and checkout). Plugins higher in
        the list appear first when multiple plugins contribute to the same slot.
        It does not change how plugins are listed on the Plugins tab.
      </p>

      {plugins.length === 0 ? (
        <EmptyState
          title="No plugins registered"
          description="Plugins are loaded from app/plugins/ at startup."
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
                    <Badge tone="success">Enabled</Badge>
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
 * Main plugins tab — enable/disable and configure plugins.
 *
 * @param {{ plugins: object[], enabledPlugins: string[], pluginSettings: object }} props
 */
function PluginsTab({ plugins, enabledPlugins, pluginSettings }) {
  const emailPlugins = plugins.filter(isEmailProviderPlugin);
  const otherPlugins = plugins.filter(
    (manifest) => !isEmailProviderPlugin(manifest)
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-text mb-1 text-lg font-semibold">
          Email providers
        </h2>
        <p className="text-text-muted mb-3 text-sm">
          Activate exactly one email transport. Activating another provider
          automatically deactivates the current one. Configure API credentials
          via environment variables.
        </p>

        {emailPlugins.length === 0 ? (
          <EmptyState
            title="No email provider plugins"
            description="Bundled Resend, SendGrid, and Amazon SES plugins should appear here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {emailPlugins.map((manifest) => (
              <PluginCard
                key={manifest.id}
                manifest={manifest}
                isEnabled={enabledPlugins.includes(manifest.id)}
                pluginSettings={pluginSettings}
                isEmailProvider
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-text mb-3 text-lg font-semibold">Other plugins</h2>

        {otherPlugins.length === 0 ? (
          <EmptyState
            title="No other plugins registered"
            description="Plugins are loaded from app/plugins/ at startup."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherPlugins.map((manifest) => (
              <PluginCard
                key={manifest.id}
                manifest={manifest}
                isEnabled={enabledPlugins.includes(manifest.id)}
                pluginSettings={pluginSettings}
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
  const { plugins, orderedPlugins, enabledPlugins, pluginSettings } =
    useLoaderData();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plugins"
        subtitle="Manage installed plugins. Enable or disable plugins and configure their settings."
      />

      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {activeTab === 0 && (
        <PluginsTab
          plugins={plugins}
          enabledPlugins={enabledPlugins}
          pluginSettings={pluginSettings}
        />
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
