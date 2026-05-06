// app/routes/admin/themes/index.jsx
// Admin Themes page — list registered themes, activate, and configure settings.

import { useEffect, useRef } from 'react';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';

import cache from '#/utils/cache.server';

import { get, set } from '#/core/settings/index.server';
import { _registry, resolveActiveTheme } from '#/core/themes/index.server';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export function meta() {
  return [
    { title: 'Themes — Admin' },
    { name: 'description', content: 'Manage storefront themes' },
  ];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Loads all registered themes and the active theme manifest + settings.
 */
export async function loader() {
  // All registered themes (may be empty at Phase 5)
  const themes = Array.from(_registry.values());

  // Raw active theme ID from settings
  const activeThemeId = await get('activeTheme');

  // Active theme manifest (null if registry is empty or ID not found)
  const activeTheme = await resolveActiveTheme();

  // If the active theme has settings, load their current values
  let themeSettings = {};
  if (activeTheme?.settings?.length) {
    const entries = await Promise.all(
      activeTheme.settings.map(async (s) => {
        const val = await get(`theme.${activeTheme.id}.${s.key}`);
        return [s.key, val ?? s.default ?? ''];
      })
    );
    themeSettings = Object.fromEntries(entries);
  }

  return { themes, activeThemeId, activeTheme, themeSettings };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

/**
 * Handles:
 *  - intent=activate   → set activeTheme + bust cache
 *  - intent=save-settings → persist each theme setting value
 */
export async function action({ request }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'activate') {
    const themeId = formData.get('themeId');
    if (!themeId) return { error: 'Missing themeId' };

    await set('activeTheme', themeId);
    // Also bust the TTL cache entry used by resolveActiveTheme
    cache.delete('theme:active');

    return { success: true, activated: themeId };
  }

  if (intent === 'save-settings') {
    const themeId = formData.get('themeId');
    if (!themeId) return { error: 'Missing themeId' };

    const manifest = _registry.get(themeId);
    if (!manifest?.settings?.length) return { error: 'No settings for theme' };

    await Promise.all(
      manifest.settings.map(async (s) => {
        const raw = formData.get(s.key);
        // Toggles arrive as 'on' or null; normalise to boolean
        const value = s.type === 'toggle' ? raw === 'on' : (raw ?? '');
        await set(`theme.${themeId}.${s.key}`, value);
      })
    );

    return { success: true, savedSettings: true };
  }

  return { error: `Unknown intent: ${intent}` };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Badge shown on the currently-active theme card.
 */
function ActiveBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
      Active
    </span>
  );
}

/**
 * A single theme card.
 *
 * @param {{ manifest: object, isActive: boolean }} props
 */
function ThemeCard({ manifest, isActive }) {
  const navigation = useNavigation();
  const isActivating =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'activate' &&
    navigation.formData?.get('themeId') === manifest.id;

  return (
    <div
      className={[
        'rounded-xl border p-5 transition-colors',
        isActive
          ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30'
          : 'border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {manifest.name}
            </h3>
            {isActive && <ActiveBadge />}
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

        {/* Activate button — only for inactive themes */}
        {!isActive && (
          <Form method="post" className="flex-shrink-0">
            <input type="hidden" name="intent" value="activate" />
            <input type="hidden" name="themeId" value={manifest.id} />
            <button
              type="submit"
              disabled={isActivating}
              className="rounded-lg border border-indigo-600 px-3 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            >
              {isActivating ? 'Activating…' : 'Activate'}
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}

/**
 * Manifest-driven settings form for the active theme.
 *
 * @param {{ manifest: object, values: object }} props
 */
function ThemeSettingsForm({ manifest, values }) {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving =
    navigation.state === 'submitting' &&
    navigation.formData?.get('intent') === 'save-settings';

  const formRef = useRef(null);

  // Show a brief success flash
  useEffect(() => {
    if (actionData?.savedSettings && formRef.current) {
      // nothing special needed — the loader refreshes the values automatically
    }
  }, [actionData]);

  if (!manifest.settings?.length) return null;

  return (
    <div className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white">
      <div className="dark:border-dark-700 border-b border-gray-200 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Theme Settings
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          Configure options for{' '}
          <span className="font-medium">{manifest.name}</span>.
        </p>
      </div>

      <Form
        ref={formRef}
        method="post"
        className="dark:divide-dark-700/60 divide-y divide-gray-100"
      >
        <input type="hidden" name="intent" value="save-settings" />
        <input type="hidden" name="themeId" value={manifest.id} />

        <div className="space-y-5 px-5 py-5">
          {manifest.settings.map((setting) => (
            <SettingField
              key={setting.key}
              setting={setting}
              value={values[setting.key] ?? setting.default ?? ''}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          {actionData?.savedSettings && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Settings saved.
            </p>
          )}
          {actionData?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {actionData.error}
            </p>
          )}
          {!actionData?.savedSettings && !actionData?.error && <span />}

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

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

/**
 * Admin Themes Route
 *
 * @returns {React.ReactElement}
 */
export default function AdminThemesRoute() {
  const { themes, activeThemeId, activeTheme, themeSettings } = useLoaderData();

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Themes
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your storefront&apos;s appearance.
          </p>
        </div>

        {/* Storefront preview link */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="dark:border-dark-600 dark:bg-dark-800 dark:hover:bg-dark-700 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-300"
        >
          Preview Storefront
          <svg
            className="h-3.5 w-3.5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        </a>
      </div>

      {/* Active theme ID note (always show so admin can see what's configured) */}
      {activeThemeId && !activeTheme && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-300">
          Active theme ID is set to{' '}
          <span className="font-mono font-medium">{activeThemeId}</span>, but no
          matching theme is registered. Register the theme at startup to
          activate it.
        </div>
      )}

      {/* Theme list */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Registered Themes
        </h2>

        {themes.length === 0 ? (
          <div className="dark:border-dark-700 dark:bg-dark-800 rounded-xl border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No themes registered. Themes are loaded from{' '}
              <span className="font-mono">app/themes/</span> at startup.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((manifest) => (
              <ThemeCard
                key={manifest.id}
                manifest={manifest}
                isActive={manifest.id === activeThemeId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Manifest-driven settings form — only if active theme has settings */}
      {activeTheme?.settings?.length > 0 && (
        <ThemeSettingsForm manifest={activeTheme} values={themeSettings} />
      )}
    </div>
  );
}
