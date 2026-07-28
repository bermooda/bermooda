import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { settingsGet, settingsSet } = vi.hoisted(() => ({
  settingsGet: vi.fn().mockResolvedValue(null),
  settingsSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: settingsGet,
  set: settingsSet,
}));

import {
  decryptSecret,
  isEncryptedSecret,
  PASSWORD_SETTING_SET,
} from '#/utils/secrets.server';
import {
  getPluginSettingSecret,
  loadPluginSettings,
  savePluginSettings,
  savePluginSettingsValues,
} from '#/core/plugins/settings.server';

describe('plugin settings password fields', () => {
  const previousSecret = process.env.BETTER_AUTH_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BETTER_AUTH_SECRET = 'test-better-auth-secret-for-unit-tests';
    settingsGet.mockResolvedValue(null);
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previousSecret;
    }
  });

  const manifest = {
    id: '@bermooda/plugin-resend',
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password' },
      { key: 'fromName', label: 'From Name', type: 'text' },
    ],
  };

  it('redacts password values on load', async () => {
    settingsGet.mockImplementation(async (key) => {
      if (key.endsWith('.apiKey')) return 'enc:v1:fake';
      if (key.endsWith('.fromName')) return 'Shop';
      return null;
    });

    const values = await loadPluginSettings(manifest);
    expect(values.apiKey).toBe(PASSWORD_SETTING_SET);
    expect(values.fromName).toBe('Shop');
  });

  it('encrypts password on save and skips empty password', async () => {
    const formData = new FormData();
    formData.set('apiKey', 're_new_secret');
    formData.set('fromName', 'Store');

    await savePluginSettings(manifest.id, manifest, formData);

    expect(settingsSet).toHaveBeenCalledTimes(2);
    const apiCall = settingsSet.mock.calls.find(([key]) =>
      key.endsWith('.apiKey')
    );
    expect(apiCall).toBeTruthy();
    expect(isEncryptedSecret(apiCall[1])).toBe(true);
    expect(decryptSecret(apiCall[1])).toBe('re_new_secret');

    settingsSet.mockClear();
    const keepForm = new FormData();
    keepForm.set('apiKey', '');
    keepForm.set('fromName', 'Store');
    await savePluginSettings(manifest.id, manifest, keepForm);

    const keys = settingsSet.mock.calls.map(([key]) => key);
    expect(keys.some((k) => k.endsWith('.apiKey'))).toBe(false);
    expect(keys.some((k) => k.endsWith('.fromName'))).toBe(true);
  });

  it('encrypts password via JSON save and keeps when omitted', async () => {
    await savePluginSettingsValues(manifest.id, manifest, {
      apiKey: 're_json',
      fromName: 'A',
    });
    const apiCall = settingsSet.mock.calls.find(([key]) =>
      key.endsWith('.apiKey')
    );
    expect(isEncryptedSecret(apiCall[1])).toBe(true);
    expect(decryptSecret(apiCall[1])).toBe('re_json');

    settingsSet.mockClear();
    await savePluginSettingsValues(manifest.id, manifest, {
      fromName: 'B',
    });
    expect(
      settingsSet.mock.calls.some(([key]) => key.endsWith('.apiKey'))
    ).toBe(false);
  });

  it('decrypts stored password secrets for providers', async () => {
    const { encryptSecret } = await import('#/utils/secrets.server');
    const ciphertext = encryptSecret('re_live');
    settingsGet.mockResolvedValue(ciphertext);

    await expect(
      getPluginSettingSecret('@bermooda/plugin-resend', 'apiKey')
    ).resolves.toBe('re_live');
  });
});
