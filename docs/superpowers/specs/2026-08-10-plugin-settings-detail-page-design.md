# Plugin settings on plugin detail page

**Date:** 2026-08-10  
**Status:** Approved for implementation  
**Repos:** bermooda (app)

## Problem

Manifest-driven plugin config fields currently render inline inside each plugin card on `/admin/plugins`. That crowds the grid, diverges from the admin detail/editor pattern, and mixes list actions (enable/disable) with configuration. The card link is labeled “Plugin Admin” even when the primary need is settings.

## Goals

- Show plugin config fields on `/admin/plugins/:slug` using the product-editor detail layout (`max-w-5xl`, breadcrumbs, `PageHeader`, `FormSection`, footer Cancel + Save).
- Keep enable/disable (and email activate/deactivate) on the plugins index cards only.
- Rename the card link to **Settings**.
- When a plugin has both settings and a custom admin UI, show settings above the custom component.
- Show the Settings link only when the plugin has settings and/or a resolvable custom admin root route.

## Non-goals

- No new URL routes (still `/admin/plugins` and `/admin/plugins/:slug/*`).
- No changes to plugin manifests or the `savePluginSettings` / `loadPluginSettings` core API.
- No changes to block-order tab behavior.

## UX

### Plugins index (`/admin/plugins`)

- Cards: title, meta, description, enable/disable (or activate/deactivate for email providers).
- Remove inline `PluginSettingsForm` from cards.
- Rename i18n key `admin.plugins.index.pluginAdmin` → `admin.plugins.index.settings` with label **Settings** / **Einstellungen** / **Paramètres** (no trailing `→`).
- Show the link only when `manifest.settings?.length > 0` **or** `resolvePluginAdminRoute(slug, '')` is non-null. Index loader computes a `hasAdminUi` (or equivalent) flag per plugin so the card does not guess.

### Plugin detail (`/admin/plugins/:slug`)

- Chrome: `mx-auto max-w-5xl` → sticky `PageHeader` with breadcrumbs (`Plugins` → plugin title) → subtitle (`v{version} · {id}`).
- Manifest settings form renders only on the plugin root path (`splat` empty). Nested plugin admin paths (`:slug/*`) keep existing dispatcher behavior without duplicating the settings form.
- If settings exist on root: `FormSection` for settings fields (text / password / select / toggle), then footer with Cancel (link to `/admin/plugins`) + Save.
- Below settings (when present on root): plugin custom admin `Component`, unchanged props (`loaderData`).
- Settings-only plugins: settings page (not “no admin pages” error chrome).
- Custom-admin-only plugins: header + custom UI only.
- Neither: keep existing empty/error chrome; Settings link hidden on index.

## Data flow

### Loader (`$pluginId`)

- Resolve plugin by slug (unchanged).
- When `manifest.settings?.length`, load values via `loadPluginSettings(manifest)`.
- Resolve admin route + run plugin loader when a descriptor matches (unchanged).
- Treat settings-without-admin-routes as a successful page (settings chrome), not `no-admin-routes` error.

### Action (`$pluginId`)

- `intent=save-settings` → `savePluginSettings(pluginId, manifest, formData)` (moved from index).
- Otherwise → existing plugin `descriptor.action` dispatch.
- Index action drops `save-settings`; keeps enable / disable / reorder.
- Index loader drops `loadAllPluginSettings` / `pluginSettings` (no longer needed on the list).

## Components

- Extract settings field rendering into `#/components/admin/plugin-settings-form.jsx`.
- Compose with existing admin primitives: `Breadcrumbs`, `PageHeader`, `FormSection`, `Field`, `Input`, `Select`, `ButtonSubmit`, `SuccessAlert` / `ErrorAlert`.

## i18n

- Replace `admin.plugins.index.pluginAdmin` with `admin.plugins.index.settings`.
- Move detail-page settings copy to `admin.plugins.detail.*` (`settingsTitle`, `settingsDescription`, `settingsSaved`, `saveSettings`, `passwordKeepPlaceholder`); remove unused `admin.plugins.index.settings*` keys once nothing references them.
- Ensure settings-only plugins do not surface `noAdminPages` empty state.

## Testing

- Index: cards do not render settings fields; Settings link gated by settings and/or `hasAdminUi`; unknown `save-settings` intent returns the existing unknown-intent error from the index action.
- Detail: loader returns settings values; `save-settings` succeeds; settings render above custom Component when both exist on root; settings-only plugins are not `no-admin-routes` error chrome; nested splat paths do not re-render the settings form.

## Approach chosen

Host settings in `$pluginId` as core chrome above the plugin dispatcher (Approach 1). Rejected: dedicated `/settings` sub-route (splits B); keeping save on the index action (split ownership).
