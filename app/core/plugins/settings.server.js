// Plugin settings persistence helpers (including encrypted password fields).

import {
  decryptSecret,
  encryptSecret,
  PASSWORD_SETTING_SET,
  shouldKeepExistingPassword,
} from '#/utils/secrets.server';
import {
  get as settingsGet,
  set as settingsSet,
} from '#/core/settings/index.server';

export { PASSWORD_SETTING_SET };

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
 * Settings table key for a plugin setting field.
 *
 * @param {string} pluginId
 * @param {string} key
 * @returns {string}
 */
export function pluginSettingStorageKey(pluginId, key) {
  return `plugin.${pluginId}.${key}`;
}

/**
 * Redact a stored plugin setting for admin/API display.
 * Password fields never expose ciphertext or plaintext.
 *
 * @param {PluginSettingField} setting
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactPluginSettingValue(setting, value) {
  if (setting?.type === 'password') {
    if (value == null || value === '') return '';
    return PASSWORD_SETTING_SET;
  }
  return value ?? setting?.default ?? '';
}

/**
 * Loads persisted values for a plugin's manifest-driven settings.
 * Password fields are redacted (`PASSWORD_SETTING_SET` when configured).
 *
 * @param {{ id: string, settings?: PluginSettingField[] }|null|undefined} manifest
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loadPluginSettings(manifest) {
  if (!manifest?.settings?.length) return {};

  const entries = await Promise.all(
    manifest.settings.map(async (setting) => {
      const value = await settingsGet(
        pluginSettingStorageKey(manifest.id, setting.key)
      );
      return [setting.key, redactPluginSettingValue(setting, value)];
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Loads persisted settings for all plugins that declare settings fields.
 *
 * @param {Array<{ id: string, settings?: PluginSettingField[] }>} plugins
 * @returns {Promise<Record<string, Record<string, unknown>>>}
 */
export async function loadAllPluginSettings(plugins) {
  const entries = await Promise.all(
    plugins.map(async (manifest) => [
      manifest.id,
      await loadPluginSettings(manifest),
    ])
  );

  return Object.fromEntries(entries);
}

/**
 * Reads a plugin setting and decrypts it when stored as a password secret.
 *
 * @param {string} pluginId
 * @param {string} key
 * @returns {Promise<string | null>}
 */
export async function getPluginSettingSecret(pluginId, key) {
  const raw = await settingsGet(pluginSettingStorageKey(pluginId, key));
  if (raw == null || raw === '') return null;
  return decryptSecret(String(raw));
}

/**
 * Reads a non-secret plugin setting value.
 *
 * @param {string} pluginId
 * @param {string} key
 * @returns {Promise<unknown>}
 */
export async function getPluginSettingValue(pluginId, key) {
  return settingsGet(pluginSettingStorageKey(pluginId, key));
}

/**
 * Normalizes a single plugin setting value from form data.
 *
 * @param {PluginSettingField} setting
 * @param {FormDataEntryValue|null} raw
 * @returns {unknown}
 */
export function parsePluginSettingValue(setting, raw) {
  if (setting.type === 'toggle') {
    return raw === 'on';
  }

  return raw ?? '';
}

/**
 * Resolve the value to persist for one setting field.
 * Password fields are encrypted; empty/sentinel submissions keep the existing value.
 *
 * @param {string} _pluginId
 * @param {PluginSettingField} setting
 * @param {unknown} raw
 * @returns {Promise<{ skip: true } | { skip: false, value: unknown }>}
 */
export async function resolvePluginSettingForPersist(_pluginId, setting, raw) {
  if (setting.type === 'password') {
    if (shouldKeepExistingPassword(raw)) {
      return { skip: true };
    }
    return { skip: false, value: encryptSecret(String(raw)) };
  }

  if (setting.type === 'toggle') {
    return { skip: false, value: Boolean(raw === 'on' || raw === true) };
  }

  if (raw === undefined || raw === null) {
    return { skip: false, value: setting.default ?? '' };
  }

  return { skip: false, value: raw };
}

/**
 * Persists plugin settings from an admin form submission.
 *
 * @param {string} pluginId
 * @param {{ settings?: PluginSettingField[] }} manifest
 * @param {FormData} formData
 * @returns {Promise<void>}
 */
export async function savePluginSettings(pluginId, manifest, formData) {
  if (!manifest?.settings?.length) {
    throw new Error('No settings for plugin');
  }

  await Promise.all(
    manifest.settings.map(async (setting) => {
      const raw = formData.get(setting.key);
      const parsed =
        setting.type === 'password'
          ? raw
          : parsePluginSettingValue(setting, raw);
      const resolved = await resolvePluginSettingForPersist(
        pluginId,
        setting,
        parsed
      );
      if (resolved.skip) return;
      await settingsSet(
        pluginSettingStorageKey(pluginId, setting.key),
        resolved.value
      );
    })
  );
}

/**
 * Normalize a plugin setting value from a JSON object payload.
 *
 * @param {PluginSettingField} setting
 * @param {unknown} raw
 * @returns {unknown}
 */
export function parsePluginSettingJsonValue(setting, raw) {
  if (setting.type === 'toggle') {
    return Boolean(raw);
  }
  if (setting.type === 'password') {
    return raw;
  }
  if (raw === undefined || raw === null) {
    return setting.default ?? '';
  }
  return raw;
}

/**
 * Persists plugin settings from a JSON object (Admin API).
 * Password fields: omit or send empty/sentinel to keep; send a new string to replace.
 *
 * @param {string} pluginId
 * @param {{ settings?: PluginSettingField[] }} manifest
 * @param {Record<string, unknown>} values
 * @returns {Promise<void>}
 */
export async function savePluginSettingsValues(
  pluginId,
  manifest,
  values = {}
) {
  if (!manifest?.settings?.length) {
    throw Object.assign(new Error('No settings for plugin'), {
      code: 'PLUGIN_INVALID',
      status: 400,
    });
  }

  await Promise.all(
    manifest.settings.map(async (setting) => {
      const hasKey = Object.prototype.hasOwnProperty.call(values, setting.key);
      if (setting.type === 'password') {
        const resolved = await resolvePluginSettingForPersist(
          pluginId,
          setting,
          hasKey ? values[setting.key] : undefined
        );
        if (resolved.skip) return;
        await settingsSet(
          pluginSettingStorageKey(pluginId, setting.key),
          resolved.value
        );
        return;
      }

      const value = hasKey
        ? parsePluginSettingJsonValue(setting, values[setting.key])
        : (setting.default ?? (setting.type === 'toggle' ? false : ''));
      await settingsSet(pluginSettingStorageKey(pluginId, setting.key), value);
    })
  );
}
