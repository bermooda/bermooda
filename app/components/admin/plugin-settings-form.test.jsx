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
  useNavigation: () => ({ state: 'idle' }),
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
