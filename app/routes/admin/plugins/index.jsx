// app/routes/admin/plugins/index.jsx
// Admin Plugins page — list registered plugins, enable/disable, reorder, settings.

import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useRef } from 'react';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

import { _registry, disable, enable } from '#/core/plugins/index.server';
import { get, set } from '#/core/settings/index.server';

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
  // All plugins from the in-memory registry
  const allPlugins = Array.from(_registry.values()).map((e) => e.manifest);

  // enabledPlugins: JSON array of plugin IDs
  const enabledPluginsRaw = await get('enabledPlugins');
  const enabledPlugins = Array.isArray(enabledPluginsRaw)
    ? enabledPluginsRaw
    : [];

  // pluginOrder: JSON array of plugin IDs for display order
  const pluginOrderRaw = await get('pluginOrder');
  const pluginOrder = Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [];

  // Sort plugins by pluginOrder; any not in order appear at the end
  const orderedPlugins = [...allPlugins].sort((a, b) => {
    const ai = pluginOrder.indexOf(a.id);
    const bi = pluginOrder.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // Per-plugin settings values
  const pluginSettings = {};
  for (const plugin of allPlugins) {
    if (plugin.settings?.length) {
      const entries = await Promise.all(
        plugin.settings.map(async (s) => {
          const val = await get(`plugin.${plugin.id}.${s.key}`);
          return [s.key, val ?? s.default ?? ''];
        })
      );
      pluginSettings[plugin.id] = Object.fromEntries(entries);
    }
  }

  return {
    plugins: orderedPlugins,
    enabledPlugins,
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
 *  - intent=reorder-up    → move plugin one position earlier in pluginOrder
 *  - intent=reorder-down  → move plugin one position later in pluginOrder
 *  - intent=save-settings → persist per-plugin setting values
 */
export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'enable' || intent === 'disable') {
    const pluginId = formData.get('pluginId');
    if (!pluginId) return { error: 'Missing pluginId' };
    if (!_registry.has(pluginId)) return { error: 'Plugin not found' };

    const enabledRaw = await get('enabledPlugins');
    const previousEnabled = Array.isArray(enabledRaw) ? [...enabledRaw] : [];
    const enabled = [...previousEnabled];

    if (intent === 'enable') {
      if (!enabled.includes(pluginId)) enabled.push(pluginId);
    } else {
      const idx = enabled.indexOf(pluginId);
      if (idx !== -1) enabled.splice(idx, 1);
    }

    await set('enabledPlugins', enabled);
    try {
      if (intent === 'enable') {
        await enable(pluginId);
      } else {
        await disable(pluginId);
      }
    } catch (err) {
      await set('enabledPlugins', previousEnabled);
      return {
        error:
          err instanceof Error ? err.message : 'Failed to update plugin state',
      };
    }

    return { success: true, intent };
  }

  if (intent === 'reorder-up' || intent === 'reorder-down') {
    const pluginId = formData.get('pluginId');
    if (!pluginId) return { error: 'Missing pluginId' };

    // Build current order from all registered plugins
    const allPlugins = Array.from(_registry.values()).map((e) => e.manifest);
    const pluginOrderRaw = await get('pluginOrder');
    const storedOrder = Array.isArray(pluginOrderRaw) ? pluginOrderRaw : [];

    // Build a full ordered list: stored order first, then any untracked plugins
    const trackedIds = storedOrder.filter((id) =>
      allPlugins.some((p) => p.id === id)
    );
    const untrackedIds = allPlugins
      .map((p) => p.id)
      .filter((id) => !trackedIds.includes(id));
    const fullOrder = [...trackedIds, ...untrackedIds];

    const idx = fullOrder.indexOf(pluginId);
    if (idx === -1) return { error: 'Plugin not found' };

    const swapIdx = intent === 'reorder-up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= fullOrder.length) {
      return { success: true, intent }; // already at boundary
    }

    // Swap
    [fullOrder[idx], fullOrder[swapIdx]] = [fullOrder[swapIdx], fullOrder[idx]];

    await set('pluginOrder', fullOrder);
    return { success: true, intent };
  }

  if (intent === 'save-settings') {
    const pluginId = formData.get('pluginId');
    if (!pluginId) return { error: 'Missing pluginId' };

    const entry = _registry.get(pluginId);
    if (!entry?.manifest?.settings?.length) {
      return { error: 'No settings for plugin' };
    }

    await Promise.all(
      entry.manifest.settings.map(async (s) => {
        const raw = formData.get(s.key);
        const value = s.type === 'toggle' ? raw === 'on' : (raw ?? '');
        await set(`plugin.${pluginId}.${s.key}`, value);
      })
    );

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
 * A single plugin card.
 *
 * @param {{ manifest: object, isEnabled: boolean, isFirst: boolean, isLast: boolean, pluginSettings: object }} props
 */
function PluginCard({ manifest, isEnabled, isFirst, isLast, pluginSettings }) {
  const navigation = useNavigation();

  const isToggling =
    navigation.state === 'submitting' &&
    (navigation.formData?.get('intent') === 'enable' ||
      navigation.formData?.get('intent') === 'disable') &&
    navigation.formData?.get('pluginId') === manifest.id;

  const isReordering =
    navigation.state === 'submitting' &&
    (navigation.formData?.get('intent') === 'reorder-up' ||
      navigation.formData?.get('intent') === 'reorder-down') &&
    navigation.formData?.get('pluginId') === manifest.id;

  const toggleIntent = isEnabled ? 'disable' : 'enable';
  const values = pluginSettings[manifest.id] ?? {};

  return (
    <Card
      padded={false}
      className={isEnabled ? 'border-accent bg-accent/5 p-5' : 'p-5'}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-text truncate text-sm font-semibold">
              {manifest.name}
            </h3>
            {isEnabled && <Badge tone="success">Enabled</Badge>}
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

        {/* Enable / Disable — mirrors theme Activate button placement */}
        {!isEnabled && (
          <Form method="post" className="flex-shrink-0">
            <input type="hidden" name="intent" value={toggleIntent} />
            <input type="hidden" name="pluginId" value={manifest.id} />
            <Button type="submit" variant="secondary" disabled={isToggling}>
              Enable
            </Button>
          </Form>
        )}
      </div>

      {/* Reorder, admin link, and disable — secondary actions below header */}
      {(isEnabled || manifest.adminPath || !isFirst || !isLast) && (
        <div className="border-border mt-4 flex items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-0.5">
            <Form method="post">
              <input type="hidden" name="intent" value="reorder-up" />
              <input type="hidden" name="pluginId" value={manifest.id} />
              <button
                type="submit"
                disabled={isFirst || isReordering}
                title="Move up"
                className="text-text-muted hover:text-text rounded p-0.5 disabled:opacity-30"
              >
                <ChevronUpIcon className="h-4 w-4" />
              </button>
            </Form>
            <Form method="post">
              <input type="hidden" name="intent" value="reorder-down" />
              <input type="hidden" name="pluginId" value={manifest.id} />
              <button
                type="submit"
                disabled={isLast || isReordering}
                title="Move down"
                className="text-text-muted hover:text-text rounded p-0.5 disabled:opacity-30"
              >
                <ChevronDownIcon className="h-4 w-4" />
              </button>
            </Form>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {manifest.adminPath && (
              <a
                href={manifest.adminPath}
                className="border-border text-text hover:bg-surface-2 rounded-md border px-3 py-1.5 text-xs font-medium transition"
              >
                Plugin Admin &rarr;
              </a>
            )}
            {isEnabled && (
              <Form method="post">
                <input type="hidden" name="intent" value={toggleIntent} />
                <input type="hidden" name="pluginId" value={manifest.id} />
                <Button type="submit" variant="danger" disabled={isToggling}>
                  Disable
                </Button>
              </Form>
            )}
          </div>
        </div>
      )}

      {/* Manifest-driven settings form */}
      {manifest.settings?.length > 0 && (
        <PluginSettingsForm manifest={manifest} values={values} />
      )}
    </Card>
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
  const { plugins, enabledPlugins, pluginSettings } = useLoaderData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plugins"
        subtitle="Manage installed plugins. Display order and enabled state are persisted to settings."
      />

      {/* Plugin list */}
      <div>
        <h2 className="text-text mb-3 text-lg font-semibold">
          Registered Plugins
        </h2>

        {plugins.length === 0 ? (
          <EmptyState
            title="No plugins registered"
            description="Plugins are loaded from app/plugins/ at startup."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((manifest, idx) => (
              <PluginCard
                key={manifest.id}
                manifest={manifest}
                isEnabled={enabledPlugins.includes(manifest.id)}
                isFirst={idx === 0}
                isLast={idx === plugins.length - 1}
                pluginSettings={pluginSettings}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
