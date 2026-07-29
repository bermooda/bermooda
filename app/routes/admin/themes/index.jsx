// app/routes/admin/themes/index.jsx
// Admin Themes page — list registered themes, activate, and configure settings.

import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';
import { Form, useActionData, useLoaderData } from 'react-router';

import { get } from '#/core/settings/index.server';
import {
  getRegisteredTheme,
  listRegisteredThemes,
  loadThemeSettings,
  resolveActiveTheme,
  saveThemeSettings,
  setActiveTheme,
} from '#/core/themes/index.server';
import Badge from '#/components/admin/badge';
import Card from '#/components/admin/card';
import EmptyState from '#/components/admin/empty-state';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import PageHeader from '#/components/admin/page-header';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import Button, { ButtonSubmit } from '#/components/ui/button';

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
  const [themes, activeThemeRaw, activeTheme] = await Promise.all([
    Promise.resolve(listRegisteredThemes()),
    get('activeTheme'),
    resolveActiveTheme(),
  ]);
  const activeThemeId =
    typeof activeThemeRaw === 'string' ? activeThemeRaw : null;
  const themeSettings = await loadThemeSettings(activeTheme);

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

    try {
      await setActiveTheme(themeId);
    } catch (err) {
      return { error: err.message };
    }

    return { success: true, activated: themeId };
  }

  if (intent === 'save-settings') {
    const themeId = formData.get('themeId');
    if (!themeId) return { error: 'Missing themeId' };

    const manifest = getRegisteredTheme(themeId);
    if (!manifest) return { error: 'Theme not found' };

    try {
      await saveThemeSettings(themeId, manifest, formData);
    } catch (err) {
      return { error: err.message };
    }

    return { success: true, savedSettings: true };
  }

  return { error: `Unknown intent: ${intent}` };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * A single theme card.
 *
 * @param {{ manifest: object, isActive: boolean }} props
 */
function ThemeCard({ manifest, isActive }) {
  return (
    <Card
      padded={false}
      className={isActive ? 'border-accent bg-accent/5 p-5' : 'p-5'}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-text truncate text-sm font-semibold">
              {manifest.title}
            </h3>
            {isActive && <Badge tone="success">Active</Badge>}
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

        {/* Activate button — only for inactive themes */}
        {!isActive && (
          <Form method="post" className="flex-shrink-0">
            <input type="hidden" name="intent" value="activate" />
            <input type="hidden" name="themeId" value={manifest.id} />
            <Button type="submit" variant="secondary">
              Activate
            </Button>
          </Form>
        )}
      </div>
    </Card>
  );
}

/**
 * Manifest-driven settings form for the active theme.
 *
 * @param {{ manifest: object, values: object }} props
 */
function ThemeSettingsForm({ manifest, values }) {
  const actionData = useActionData();
  const formRef = useRef(null);

  // Show a brief success flash
  useEffect(() => {
    if (actionData?.savedSettings && formRef.current) {
      // nothing special needed — the loader refreshes the values automatically
    }
  }, [actionData]);

  if (!manifest.settings?.length) return null;

  return (
    <Card padded={false}>
      <div className="border-border border-b px-5 py-4">
        <h2 className="text-text text-base font-semibold">Theme Settings</h2>
        <p className="text-text-muted mt-0.5 text-sm">
          Configure options for{' '}
          <span className="text-text font-medium">{manifest.title}</span>.
        </p>
      </div>

      <Form ref={formRef} method="post" className="divide-border divide-y">
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

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          {actionData?.savedSettings ? (
            <SuccessAlert message="Settings saved." />
          ) : actionData?.error ? (
            <ErrorAlert message={actionData.error} />
          ) : (
            <span />
          )}

          <ButtonSubmit>Save Settings</ButtonSubmit>
        </div>
      </Form>
    </Card>
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
      <PageHeader
        title="Themes"
        subtitle="Manage your storefront's appearance."
        actions={
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-surface text-text hover:bg-surface-2 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition"
          >
            Preview Storefront
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
          </a>
        }
      />

      {/* Active theme ID note (always show so admin can see what's configured) */}
      {activeThemeId && !activeTheme && (
        <div className="border-warn/40 bg-warn/10 text-warn rounded-lg border px-4 py-3 text-sm">
          Active theme ID is set to{' '}
          <span className="font-mono font-medium">{activeThemeId}</span>, but no
          matching theme is registered. Register the theme at startup to
          activate it.
        </div>
      )}

      {/* Theme list */}
      <div>
        <h2 className="text-text mb-3 text-lg font-semibold">
          Registered Themes
        </h2>

        {themes.length === 0 ? (
          <EmptyState
            title="No themes registered"
            description="Themes are loaded from app/themes/ at startup."
          />
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
