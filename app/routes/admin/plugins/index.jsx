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

import { _registry } from '#/core/plugins/index.server';
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

    const enabledRaw = await get('enabledPlugins');
    const enabled = Array.isArray(enabledRaw) ? [...enabledRaw] : [];

    if (intent === 'enable') {
      if (!enabled.includes(pluginId)) enabled.push(pluginId);
    } else {
      const idx = enabled.indexOf(pluginId);
      if (idx !== -1) enabled.splice(idx, 1);
    }

    await set('enabledPlugins', enabled);
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
 * Enabled badge shown on active plugins.
 */
function EnabledBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
      Enabled
    </span>
  );
}

/**
 * Disabled badge shown on inactive plugins.
 */
function DisabledBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      Disabled
    </span>
  );
}

/**
 * Renders a single setting field based on its type.
 *
 * @param {{ setting: object, value: any }} props
 */
function SettingField({ setting, value }) {
  const { key, label, type, options } = setting;
  const id = `setting-${key}`;

  return (
    <div>
      {type !== 'toggle' && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label ?? key}
        </label>
      )}

      {type === 'text' && (
        <input
          id={id}
          type="text"
          name={key}
          defaultValue={value}
          className="dark:border-dark-600 dark:bg-dark-700 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:text-white"
        />
      )}

      {type === 'select' && (
        <select
          id={id}
          name={key}
          defaultValue={value}
          className="dark:border-dark-600 dark:bg-dark-700 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:text-white"
        >
          {(options ?? []).map((opt) => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            );
          })}
        </select>
      )}

      {type === 'toggle' && (
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              id={id}
              type="checkbox"
              name={key}
              defaultChecked={value === true || value === 'true'}
              className="peer sr-only"
            />
            <div className="dark:bg-dark-600 h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-indigo-600 dark:peer-checked:bg-indigo-500" />
            <div className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label ?? key}
          </span>
        </label>
      )}
    </div>
  );
}

/**
 * Manifest-driven settings form for a plugin.
 *
 * @param {{ manifest: object, values: object }} props
 */
function PluginSettingsForm({ manifest, values }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const formRef = useRef(null);

  const isSaving =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'save-settings' &&
    navigation.formData?.get('pluginId') === manifest.id;

  const savedThisPlugin = actionData?.savedSettings === manifest.id;

  if (!manifest.settings?.length) return null;

  return (
    <div className="dark:border-dark-700 dark:bg-dark-900/40 mt-4 rounded-lg border border-gray-200 bg-gray-50">
      <div className="dark:border-dark-700 border-b border-gray-200 px-4 py-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Plugin Settings
        </h4>
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

        <div className="mt-4 flex items-center justify-between">
          {savedThisPlugin ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              Settings saved.
            </p>
          ) : actionData?.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {actionData.error}
            </p>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Settings'}
          </button>
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
    <div className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white p-5 transition-colors">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5 pt-0.5">
          <Form method="post">
            <input type="hidden" name="intent" value="reorder-up" />
            <input type="hidden" name="pluginId" value={manifest.id} />
            <button
              type="submit"
              disabled={isFirst || isReordering}
              title="Move up"
              className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-zinc-200"
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
              className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 dark:hover:text-zinc-200"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </Form>
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {manifest.name}
            </h3>
            {isEnabled ? <EnabledBadge /> : <DisabledBadge />}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            v{manifest.version} &middot;{' '}
            <span className="font-mono">{manifest.id}</span>
          </p>
          {manifest.description && (
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
              {manifest.description}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Plugin admin page link */}
          {manifest.adminPath && (
            <a
              href={manifest.adminPath}
              className="dark:border-dark-600 dark:hover:bg-dark-700 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-300"
            >
              Plugin Admin &rarr;
            </a>
          )}

          {/* Enable / Disable toggle */}
          <Form method="post">
            <input type="hidden" name="intent" value={toggleIntent} />
            <input type="hidden" name="pluginId" value={manifest.id} />
            <button
              type="submit"
              disabled={isToggling}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
                isEnabled
                  ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30'
                  : 'border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-950/40',
              ].join(' ')}
            >
              {isToggling
                ? isEnabled
                  ? 'Disabling…'
                  : 'Enabling…'
                : isEnabled
                  ? 'Disable'
                  : 'Enable'}
            </button>
          </Form>
        </div>
      </div>

      {/* Manifest-driven settings form */}
      {manifest.settings?.length > 0 && (
        <PluginSettingsForm manifest={manifest} values={values} />
      )}
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
  const { plugins, enabledPlugins, pluginSettings } = useLoaderData();

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Plugins
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage installed plugins. Display order and enabled state are
          persisted to settings.
        </p>
      </div>

      {/* Plugin list */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Registered Plugins
        </h2>

        {plugins.length === 0 ? (
          <div className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No plugins registered. Plugins are loaded from{' '}
              <span className="font-mono">app/plugins/</span> at startup.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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
