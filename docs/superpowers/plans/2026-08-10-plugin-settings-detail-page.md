# Plugin settings on detail page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move manifest-driven plugin config fields from the plugins index cards onto `/admin/plugins/:slug` using the product-editor detail layout, rename the card link to Settings, and show settings above any custom plugin admin UI.

**Architecture:** Extract a reusable `PluginSettingsForm` admin component. Host it in `$pluginId.jsx` as core chrome (`max-w-5xl` + `PageHeader` + `FormSection` + footer) on the plugin root path only. Move `save-settings` into the detail action; slim the index to enable/disable/reorder plus a gated Settings link.

**Tech Stack:** React Router 7, Vitest, existing `#/components/admin/*` primitives, `#/core/plugins` settings helpers, i18n message JSON (en/de/fr).

**Spec:** `docs/superpowers/specs/2026-08-10-plugin-settings-detail-page-design.md`

---

## File map

| Path                                            | Responsibility                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `app/components/admin/plugin-settings-form.jsx` | `SettingField` + `PluginSettingsForm` (FormSection + fields + footer) |
| `app/routes/admin/plugins/$pluginId.jsx`        | Load/save settings; host chrome + settings above custom Component     |
| `app/routes/admin/plugins/$pluginId.test.jsx`   | Loader/action/render coverage for settings paths                      |
| `app/routes/admin/plugins/index.jsx`            | Remove inline settings; gated Settings link; drop save-settings       |
| `app/routes/admin/plugins/index.test.jsx`       | Assert save-settings unknown; keep enable/disable                     |
| `app/core/i18n/messages/{en,de,fr}.json`        | Rename Settings label; move detail settings copy                      |

---

### Task 1: i18n keys

**Files:**

- Modify: `app/core/i18n/messages/en.json`
- Modify: `app/core/i18n/messages/de.json`
- Modify: `app/core/i18n/messages/fr.json`

- [ ] **Step 1: Update English keys**

In `en.json`:

1. Replace:
   - `"admin.plugins.index.pluginAdmin": "Plugin Admin →"`
   - with `"admin.plugins.index.settings": "Settings"`
2. Remove (will move to detail):
   - `admin.plugins.index.settingsTitle`
   - `admin.plugins.index.settingsSaved`
   - `admin.plugins.index.saveSettings`
   - `admin.plugins.index.passwordKeepPlaceholder`
3. Add near existing `admin.plugins.detail.*` keys:

```json
  "admin.plugins.detail.settingsTitle": "Settings",
  "admin.plugins.detail.settingsDescription": "Configure this plugin. Changes apply after you save.",
  "admin.plugins.detail.settingsSaved": "Settings saved.",
  "admin.plugins.detail.saveSettings": "Save",
  "admin.plugins.detail.passwordKeepPlaceholder": "•••••••• (saved — leave blank to keep)",
  "admin.plugins.detail.cancel": "Cancel"
```

Keep `admin.plugins.detail.noAdminPages` / `noAdminPagesForPath` for true empty states (no settings and no admin UI).

- [ ] **Step 2: Mirror de/fr**

| Key                                            | de                                                                 | fr                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `admin.plugins.index.settings`                 | Einstellungen                                                      | Paramètres                                                                   |
| `admin.plugins.detail.settingsTitle`           | Einstellungen                                                      | Paramètres                                                                   |
| `admin.plugins.detail.settingsDescription`     | Dieses Plugin konfigurieren. Änderungen gelten nach dem Speichern. | Configurez ce plugin. Les modifications s'appliquent après l'enregistrement. |
| `admin.plugins.detail.settingsSaved`           | Einstellungen gespeichert.                                         | Paramètres enregistrés.                                                      |
| `admin.plugins.detail.saveSettings`            | Speichern                                                          | Enregistrer                                                                  |
| `admin.plugins.detail.passwordKeepPlaceholder` | •••••••• (gespeichert — leer lassen zum Behalten)                  | •••••••• (enregistré — laisser vide pour conserver)                          |
| `admin.plugins.detail.cancel`                  | Abbrechen                                                          | Annuler                                                                      |

Remove the same four `admin.plugins.index.settings*` keys and `pluginAdmin` from de/fr.

- [ ] **Step 3: Commit**

```bash
git add app/core/i18n/messages/en.json app/core/i18n/messages/de.json app/core/i18n/messages/fr.json
git commit -m "$(cat <<'EOF'
chore(i18n): move plugin settings copy to detail keys

EOF
)"
```

---

### Task 2: Extract `PluginSettingsForm` component

**Files:**

- Create: `app/components/admin/plugin-settings-form.jsx`
- Create: `app/components/admin/plugin-settings-form.test.jsx`

- [ ] **Step 1: Write failing render test**

Create `app/components/admin/plugin-settings-form.test.jsx`:

```jsx
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseActionData, mockUseT } = vi.hoisted(() => ({
  mockUseActionData: vi.fn(),
  mockUseT: vi.fn((key) => key),
}));

vi.mock('react-router', () => ({
  Form: ({ children, ...props }) => <form {...props}>{children}</form>,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useActionData: mockUseActionData,
}));

vi.mock('#/core/i18n', () => ({
  useT: () => mockUseT,
}));

import PluginSettingsForm from '#/components/admin/plugin-settings-form';

const manifest = {
  id: '@acme/demo',
  settings: [
    { key: 'apiKey', label: 'API Key', type: 'text' },
    { key: 'enabled', label: 'Enabled', type: 'toggle' },
  ],
};

describe('PluginSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActionData.mockReturnValue(undefined);
  });

  it('renders setting fields and save footer', () => {
    const html = renderToStaticMarkup(
      <PluginSettingsForm
        manifest={manifest}
        values={{ apiKey: 'abc', enabled: true }}
      />
    );

    expect(html).toContain('admin.plugins.detail.settingsTitle');
    expect(html).toContain('name="apiKey"');
    expect(html).toContain('name="enabled"');
    expect(html).toContain('admin.plugins.detail.saveSettings');
    expect(html).toContain('href="/admin/plugins"');
  });

  it('returns null when the plugin has no settings', () => {
    const html = renderToStaticMarkup(
      <PluginSettingsForm manifest={{ id: '@acme/empty' }} values={{}} />
    );
    expect(html).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- app/components/admin/plugin-settings-form.test.jsx`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the component**

Create `app/components/admin/plugin-settings-form.jsx`:

```jsx
import { Form, Link, useActionData } from 'react-router';

import { useT } from '#/core/i18n';
import FormSection from '#/components/admin/form-section';
import Field from '#/components/admin/form/field';
import Input from '#/components/admin/form/input';
import Select from '#/components/admin/form/select';
import { ErrorAlert, SuccessAlert } from '#/components/ui/alert';
import { ButtonSubmit } from '#/components/ui/button';

/**
 * @typedef {{
 *   key: string,
 *   label?: string,
 *   type: 'text' | 'select' | 'toggle' | 'password',
 *   default?: unknown,
 *   options?: Array<string | { value: string, label: string }>,
 * }} PluginSettingField
 */

/**
 * Renders a single setting field based on its type.
 *
 * @param {Object} props
 * @param {PluginSettingField} props.setting
 * @param {unknown} props.value
 * @returns {React.ReactElement | null}
 */
function SettingField({ setting, value }) {
  const t = useT();
  const { key, label, type, options } = setting;
  const id = `setting-${key}`;

  if (type === 'text') {
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Input id={id} type="text" name={key} defaultValue={value ?? ''} />
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
            configured
              ? t('admin.plugins.detail.passwordKeepPlaceholder')
              : undefined
          }
        />
      </Field>
    );
  }

  if (type === 'select') {
    return (
      <Field label={label ?? key} htmlFor={id}>
        <Select id={id} name={key} defaultValue={value ?? ''}>
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
          <div className="bg-bg absolute top-0.5 left-0.5 h-4 w-4 rounded-full transition peer-checked:translate-x-4" />
        </div>
        <span className="text-text text-sm font-medium">{label ?? key}</span>
      </label>
    );
  }

  return null;
}

/**
 * Manifest-driven settings form for a plugin (product-editor layout).
 *
 * @param {Object} props
 * @param {{ id: string, settings?: PluginSettingField[] }} props.manifest
 * @param {Record<string, unknown>} props.values
 * @returns {React.ReactElement | null}
 */
export default function PluginSettingsForm({ manifest, values }) {
  const t = useT();
  const actionData = useActionData();

  if (!manifest.settings?.length) return null;

  const saved = actionData?.savedSettings === manifest.id;

  return (
    <>
      {saved ? (
        <SuccessAlert message={t('admin.plugins.detail.settingsSaved')} />
      ) : null}
      {actionData?.error && !saved ? (
        <ErrorAlert message={actionData.error} />
      ) : null}

      <Form method="post" id="plugin-settings-form">
        <input type="hidden" name="intent" value="save-settings" />
        <input type="hidden" name="pluginId" value={manifest.id} />

        <div className="space-y-12">
          <FormSection
            title={t('admin.plugins.detail.settingsTitle')}
            description={t('admin.plugins.detail.settingsDescription')}
            last
          >
            <div className="max-w-2xl space-y-4">
              {manifest.settings.map((setting) => (
                <SettingField
                  key={setting.key}
                  setting={setting}
                  value={values[setting.key] ?? setting.default ?? ''}
                />
              ))}
            </div>
          </FormSection>
        </div>
      </Form>

      <div className="mt-6 mb-6 flex items-center justify-between gap-x-6">
        <span />
        <div className="flex items-center gap-x-6">
          <Link
            to="/admin/plugins"
            className="text-text text-sm/6 font-semibold transition-colors hover:opacity-80"
          >
            {t('admin.plugins.detail.cancel')}
          </Link>
          <ButtonSubmit form="plugin-settings-form">
            {t('admin.plugins.detail.saveSettings')}
          </ButtonSubmit>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- app/components/admin/plugin-settings-form.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/plugin-settings-form.jsx app/components/admin/plugin-settings-form.test.jsx
git commit -m "$(cat <<'EOF'
feat(admin): extract plugin settings form component

EOF
)"
```

---

### Task 3: Detail route loader + action for settings

**Files:**

- Modify: `app/routes/admin/plugins/$pluginId.jsx`
- Modify: `app/routes/admin/plugins/$pluginId.test.jsx`

- [ ] **Step 1: Write failing loader/action tests**

Add mocks and cases to `$pluginId.test.jsx`:

```jsx
const {
  mockClientResolve,
  mockGetRegisteredPluginBySlug,
  mockLoadPluginSettings,
  mockSavePluginSettings,
  mockServerResolve,
  mockUseLoaderData,
} = vi.hoisted(() => ({
  mockClientResolve: vi.fn(),
  mockGetRegisteredPluginBySlug: vi.fn(),
  mockLoadPluginSettings: vi.fn(),
  mockSavePluginSettings: vi.fn(),
  mockServerResolve: vi.fn(),
  mockUseLoaderData: vi.fn(),
}));

vi.mock('#/core/plugins/index.server', () => ({
  getRegisteredPluginBySlug: mockGetRegisteredPluginBySlug,
  loadPluginSettings: mockLoadPluginSettings,
  resolvePluginAdminRoute: mockServerResolve,
  savePluginSettings: mockSavePluginSettings,
}));
```

Update the existing `no-admin-routes` test so a plugin **without** settings still returns `no-admin-routes`. Add:

```jsx
it('returns ok with settings when plugin has settings but no admin routes', async () => {
  const manifest = {
    id: '@acme/settings-only',
    title: 'Settings Only',
    slug: 'settings-only',
    settings: [{ key: 'host', label: 'Host', type: 'text' }],
  };
  mockGetRegisteredPluginBySlug.mockReturnValue(manifest);
  mockServerResolve.mockReturnValue(null);
  mockLoadPluginSettings.mockResolvedValue({ host: 'localhost' });

  const result = await loader({
    request: new Request('http://localhost/admin/plugins/settings-only'),
    params: { 'pluginId': 'settings-only', '*': '' },
  });

  expect(mockLoadPluginSettings).toHaveBeenCalledWith(manifest);
  expect(result).toMatchObject({
    status: 'ok',
    pluginId: 'settings-only',
    manifest,
    splatPath: '',
    pluginSettings: { host: 'localhost' },
    pluginLoaderData: null,
  });
});

it('saves settings via intent=save-settings without requiring a plugin action', async () => {
  const manifest = {
    id: '@acme/demo-plugin',
    title: 'Demo Plugin',
    slug: 'demo-plugin',
    settings: [{ key: 'host', type: 'text' }],
  };
  mockGetRegisteredPluginBySlug.mockReturnValue(manifest);
  mockSavePluginSettings.mockResolvedValue(undefined);

  const formData = new FormData();
  formData.set('intent', 'save-settings');
  formData.set('pluginId', '@acme/demo-plugin');
  formData.set('host', 'example.com');

  const result = await action({
    request: new Request('http://localhost/admin/plugins/demo-plugin', {
      method: 'POST',
      body: formData,
    }),
    params: { 'pluginId': 'demo-plugin', '*': '' },
  });

  expect(mockSavePluginSettings).toHaveBeenCalled();
  expect(result).toEqual({
    success: true,
    intent: 'save-settings',
    savedSettings: '@acme/demo-plugin',
  });
  expect(mockServerResolve).not.toHaveBeenCalled();
});
```

Also update the matched-route loader test expectation to allow `pluginSettings` (empty object or loaded values). When splat is non-empty and settings exist, loader should still load settings into data but UI task will not render the form on nested paths — for simplicity, only call `loadPluginSettings` when `splatPath === ''` and settings exist.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- app/routes/admin/plugins/\$pluginId.test.jsx`

Expected: FAIL on new cases (loadPluginSettings not mocked / status still no-admin-routes)

- [ ] **Step 3: Update loader and action**

In `$pluginId.jsx`, extend imports:

```js
import {
  getRegisteredPluginBySlug,
  loadPluginSettings,
  resolvePluginAdminRoute as resolveAdminRoute,
  savePluginSettings,
} from '#/core/plugins/index.server';
```

Replace loader body logic after resolving `manifest` with:

```js
const splatPath = params['*'] ?? '';
const rootDescriptor = resolveAdminRoute(pluginSlug, '');
const descriptor = resolveAdminRoute(pluginSlug, splatPath);
const hasSettings = Boolean(manifest.settings?.length);
const isRoot = splatPath === '';

if (!rootDescriptor && !descriptor && !(hasSettings && isRoot)) {
  return { status: 'no-admin-routes', pluginId: pluginSlug, manifest };
}

if (!descriptor && !(hasSettings && isRoot)) {
  return { status: 'no-match', pluginId: pluginSlug, manifest, splatPath };
}

let pluginLoaderData = null;
if (descriptor && typeof descriptor.loader === 'function') {
  pluginLoaderData = await descriptor.loader({
    request,
    params: { ...params, ...descriptor.params },
  });
}

const pluginSettings =
  hasSettings && isRoot ? await loadPluginSettings(manifest) : {};

return {
  status: 'ok',
  pluginId: pluginSlug,
  manifest,
  splatPath,
  pluginLoaderData,
  pluginSettings,
};
```

Replace action start (after resolving manifest) with:

```js
const formData = await request.clone().formData();
const intent = formData.get('intent');

if (intent === 'save-settings') {
  const pluginId = formData.get('pluginId');
  if (!pluginId || pluginId !== manifest.id) {
    return { error: 'Missing pluginId' };
  }
  if (!manifest.settings?.length) {
    return { error: 'No settings for plugin' };
  }
  try {
    await savePluginSettings(manifest.id, manifest, formData);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to save settings',
    };
  }
  return {
    success: true,
    intent: 'save-settings',
    savedSettings: manifest.id,
  };
}

// existing descriptor.action dispatch unchanged
```

**Note:** Prefer reading formData once. If cloning is awkward with the existing stream, use `await request.formData()` once and pass the same `formData` into `savePluginSettings` / plugin action only when needed. Plugin `descriptor.action` currently receives `{ request, params }` and may call `request.formData()` itself — keep passing the original `request` for plugin actions; only parse formData early when you need `intent`. Pattern:

```js
const contentType = request.headers.get('content-type') ?? '';
if (
  contentType.includes('application/x-www-form-urlencoded') ||
  contentType.includes('multipart/form-data')
) {
  const formData = await request.clone().formData();
  if (formData.get('intent') === 'save-settings') {
    // handle save-settings using formData, return
  }
}
// fall through to descriptor.action with original request
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- app/routes/admin/plugins/\$pluginId.test.jsx`

Expected: PASS (including existing cases)

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin/plugins/\$pluginId.jsx app/routes/admin/plugins/\$pluginId.test.jsx
git commit -m "$(cat <<'EOF'
feat(admin): load and save plugin settings on detail route

EOF
)"
```

---

### Task 4: Detail route UI chrome

**Files:**

- Modify: `app/routes/admin/plugins/$pluginId.jsx`
- Modify: `app/routes/admin/plugins/$pluginId.test.jsx`

- [ ] **Step 1: Write failing render test**

```jsx
it('renders settings form above the plugin component on root', () => {
  function MockPluginPage() {
    return <div>Custom Admin</div>;
  }

  mockUseLoaderData.mockReturnValue({
    status: 'ok',
    pluginId: 'demo-plugin',
    manifest: {
      id: '@acme/demo-plugin',
      title: 'Demo Plugin',
      version: '1.0.0',
      settings: [{ key: 'host', label: 'Host', type: 'text' }],
    },
    splatPath: '',
    pluginLoaderData: null,
    pluginSettings: { host: 'localhost' },
  });
  mockClientResolve.mockReturnValue({
    path: '',
    Component: MockPluginPage,
  });

  const html = renderToStaticMarkup(<AdminPluginDispatcher />);

  expect(html).toContain('Demo Plugin');
  expect(html).toContain('name="host"');
  expect(html).toContain('Custom Admin');
  // settings appear before custom admin
  expect(html.indexOf('name="host"')).toBeLessThan(
    html.indexOf('Custom Admin')
  );
});

it('does not render settings form on nested splat paths', () => {
  function MockPluginPage() {
    return <div>Nested Page</div>;
  }

  mockUseLoaderData.mockReturnValue({
    status: 'ok',
    pluginId: 'demo-plugin',
    manifest: {
      id: '@acme/demo-plugin',
      title: 'Demo Plugin',
      version: '1.0.0',
      settings: [{ key: 'host', type: 'text' }],
    },
    splatPath: 'reports',
    pluginLoaderData: {},
    pluginSettings: {},
  });
  mockClientResolve.mockReturnValue({
    path: 'reports',
    Component: MockPluginPage,
  });

  const html = renderToStaticMarkup(<AdminPluginDispatcher />);

  expect(html).toContain('Nested Page');
  expect(html).not.toContain('name="host"');
});
```

Mock `#/components/admin/plugin-settings-form` is optional — prefer real component with react-router Form/Link/useActionData mocks already present; extend the react-router mock:

```js
vi.mock('react-router', () => ({
  useLoaderData: mockUseLoaderData,
  useActionData: () => undefined,
  Form: ({ children, ...props }) => <form {...props}>{children}</form>,
  Link: ({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
```

Also mock `#/core/i18n` `useT` if not already (return key).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- app/routes/admin/plugins/\$pluginId.test.jsx`

Expected: FAIL (settings not in HTML)

- [ ] **Step 3: Implement UI**

Import:

```js
import { Link, useLoaderData } from 'react-router'; // Link if needed elsewhere
import PluginSettingsForm from '#/components/admin/plugin-settings-form';
```

Rewrite the `status === 'ok'` branch of `AdminPluginDispatcher`:

```jsx
const isRoot = data.splatPath === '';
const hasSettings = Boolean(data.manifest.settings?.length);
const descriptor = resolvePluginAdminRoute(data.pluginId, data.splatPath);
const PluginComponent = descriptor?.Component;

return (
  <div className="mx-auto max-w-5xl">
    <PageHeader
      sticky
      breadcrumbs={
        <Breadcrumbs
          items={[
            {
              label: t('admin.plugins.index.title'),
              href: '/admin/plugins',
            },
            { label: data.manifest.title },
          ]}
        />
      }
      title={data.manifest.title}
      subtitle={`v${data.manifest.version} · ${data.manifest.id}`}
    />

    {isRoot && hasSettings ? (
      <PluginSettingsForm
        manifest={data.manifest}
        values={data.pluginSettings ?? {}}
      />
    ) : null}

    {PluginComponent ? (
      <PluginComponent loaderData={data.pluginLoaderData} />
    ) : null}

    {!PluginComponent && !(isRoot && hasSettings) ? (
      <p className="text-text-muted text-sm">
        {t('admin.plugins.detail.noAdminPagesForPath')}
      </p>
    ) : null}
  </div>
);
```

Also update `PluginHostChrome` / error states to use `mx-auto max-w-5xl` for consistency (optional, small).

For `no-admin-routes` — only reached when no settings on root; keep as-is.

- [ ] **Step 4: Run tests**

Run: `npm run test -- app/routes/admin/plugins/\$pluginId.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin/plugins/\$pluginId.jsx app/routes/admin/plugins/\$pluginId.test.jsx
git commit -m "$(cat <<'EOF'
feat(admin): show plugin settings in product-editor layout

EOF
)"
```

---

### Task 5: Slim plugins index

**Files:**

- Modify: `app/routes/admin/plugins/index.jsx`
- Modify: `app/routes/admin/plugins/index.test.jsx`

- [ ] **Step 1: Write failing index action test**

In `index.test.jsx`, add:

```jsx
it('returns unknown intent for save-settings', async () => {
  const result = await action({
    request: buildRequest('save-settings', '@acme/demo-plugin'),
  });

  expect(result).toEqual({ error: 'Unknown intent: save-settings' });
});
```

- [ ] **Step 2: Run to verify current behavior still accepts save-settings (fails new expectation)**

Run: `npm run test -- app/routes/admin/plugins/index.test.jsx`

Expected: FAIL (success: true from old handler) — if it already fails differently, proceed to remove handler.

- [ ] **Step 3: Update index route**

1. Remove imports only used by settings: `getRegisteredPlugin`, `loadAllPluginSettings`, `savePluginSettings`, `Field`, `Input`, `Select`, `ButtonSubmit`, `ErrorAlert`, `SuccessAlert`, `useActionData`, `useRef` (if unused).
2. Add: `resolvePluginAdminRoute` from `#/core/plugins/index.server`.
3. Loader: drop `pluginSettings` / `loadAllPluginSettings`. Compute:

```js
const plugins = [...allPlugins]
  .sort((a, b) => a.title.localeCompare(b.title))
  .map((manifest) => ({
    ...manifest,
    hasAdminUi: Boolean(resolvePluginAdminRoute(manifest.slug, '')),
  }));
```

Return `{ plugins, orderedPlugins, enabledPlugins, pluginOrder }` without `pluginSettings`.

4. Action: delete the entire `intent === 'save-settings'` block.

5. Delete `SettingField` and `PluginSettingsForm` functions from this file.

6. Update `PluginCard`:

```jsx
function PluginCard({
  manifest,
  isEnabled,
  isEmailProvider = false,
}) {
  // ...
  const showSettings =
    Boolean(manifest.settings?.length) || Boolean(manifest.hasAdminUi);

  return (
    <Card ...>
      {/* header unchanged; remove PluginSettingsForm block */}
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
          {/* enable/disable Form unchanged */}
        </div>
      </div>
    </Card>
  );
}
```

7. Update `PluginsTab` / callers to stop passing `pluginSettings`.

8. Update default export `useLoaderData` destructure accordingly.

- [ ] **Step 4: Run index tests**

Run: `npm run test -- app/routes/admin/plugins/index.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin/plugins/index.jsx app/routes/admin/plugins/index.test.jsx
git commit -m "$(cat <<'EOF'
refactor(admin): move plugin settings off index cards

EOF
)"
```

---

### Task 6: Validation

**Files:** touched files from Tasks 1–5

- [ ] **Step 1: Run targeted tests**

```bash
npm run test -- \
  app/components/admin/plugin-settings-form.test.jsx \
  app/routes/admin/plugins/index.test.jsx \
  app/routes/admin/plugins/\$pluginId.test.jsx
```

Expected: all PASS

- [ ] **Step 2: JSDoc check on new/changed exports**

```bash
npx -p typescript tsc --noEmit --allowJs --checkJs --strict \
  --module preserve --moduleResolution bundler --target es2020 --jsx react-jsx \
  "app/components/admin/plugin-settings-form.jsx" \
  "app/routes/admin/plugins/\$pluginId.jsx" \
  "app/routes/admin/plugins/index.jsx"
```

Expected: no errors (or only pre-existing unrelated)

- [ ] **Step 3: Lint + format if needed**

```bash
npm run lint
```

If oxfmt fails: `npm run fmt` then re-run `npm run lint`.

- [ ] **Step 4: Final commit if fmt changed files**

```bash
git add -u
git commit -m "$(cat <<'EOF'
style: format plugin settings detail changes

EOF
)"
```

Only if there are formatting diffs.

---

## Spec coverage checklist

| Spec requirement                              | Task |
| --------------------------------------------- | ---- |
| Settings on detail with product-editor layout | 2, 4 |
| Settings above custom admin UI                | 4    |
| Settings only on root splat                   | 3, 4 |
| Settings-only plugins not error chrome        | 3    |
| Index cards without inline settings           | 5    |
| Settings link renamed + gated                 | 1, 5 |
| save-settings on detail; removed from index   | 3, 5 |
| i18n en/de/fr                                 | 1    |
| Tests                                         | 2–6  |

## Out of scope (do not implement)

- New routes
- Manifest / `savePluginSettings` API changes
- Block-order tab changes
