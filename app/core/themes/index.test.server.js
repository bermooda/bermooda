// app/core/themes/index.test.server.js
// Server-environment tests for the theme loader (runs in Node, not happy-dom).

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { REQUIRED_COMPONENTS, SLOT_NAMES } from '#/core/themes/manifest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use the mocked modules.
// ---------------------------------------------------------------------------

vi.mock('#/utils/logger.server', () => ({
  default: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    })),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('#/libs/prisma.server', () => ({
  default: {
    setting: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('#/utils/cache/index.server', () => ({
  default: { delete: vi.fn() },
  getCachedResult: vi.fn(async (_key, callback) => callback()),
}));

vi.mock('#/core/settings/index.server', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('#/core/plugins/index.server', () => ({
  getPluginBlocksForSlot: vi.fn(async () => []),
}));

vi.mock('#/core/themes/storefront-components/index', () => ({
  registerStorefrontTheme: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are registered.
// ---------------------------------------------------------------------------

const {
  defineTheme,
  registerTheme,
  resolveActiveTheme,
  preloadStorefrontTheme,
  invalidateThemeCache,
  listRegisteredThemes,
  getRegisteredTheme,
  loadThemeSettings,
  parseThemeSettingValue,
  saveThemeSettings,
  setActiveTheme,
  getSlotBlocks,
  getSlotBlocksMap,
  __resetRegistry,
} = await import('#/core/themes/index.server');

import cache from '#/utils/cache/index.server';
import prisma from '#/libs/prisma.server';
import { getPluginBlocksForSlot } from '#/core/plugins/index.server';
import { get, set } from '#/core/settings/index.server';
import { registerStorefrontTheme } from '#/core/themes/storefront-components/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validManifest(overrides = {}) {
  return {
    id: 'test-theme',
    name: 'Test Theme',
    version: '1.0.0',
    components: Object.fromEntries(
      REQUIRED_COMPONENTS.map((name) => [name, () => null])
    ),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// defineTheme — manifest field validation
// ---------------------------------------------------------------------------

describe('defineTheme — required manifest fields', () => {
  it('returns the manifest when all required fields are present', () => {
    const manifest = validManifest();
    expect(defineTheme(manifest)).toBe(manifest);
  });

  it('throws when "id" is missing', () => {
    const { id: _id, ...noId } = validManifest();
    expect(() => defineTheme(noId)).toThrow(/id/);
  });

  it('throws when manifest is null', () => {
    expect(() => defineTheme(null)).toThrow();
  });

  it('accepts optional description field without throwing', () => {
    const manifest = validManifest({ description: 'A storefront theme' });
    expect(() => defineTheme(manifest)).not.toThrow();
  });
});

describe('defineTheme — required component presence', () => {
  for (const componentName of REQUIRED_COMPONENTS) {
    it(`throws when "${componentName}" is absent from manifest.components`, () => {
      const manifest = validManifest();
      delete manifest.components[componentName];
      expect(() => defineTheme(manifest)).toThrow(new RegExp(componentName));
    });
  }
});

// ---------------------------------------------------------------------------
// registerTheme + registry helpers
// ---------------------------------------------------------------------------

describe('registerTheme + registry helpers', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
  });

  it('registers the theme in server and client registries', () => {
    const manifest = validManifest({ id: 'my-theme' });
    registerTheme(manifest);

    expect(listRegisteredThemes()).toEqual([manifest]);
    expect(getRegisteredTheme('my-theme')).toBe(manifest);
    expect(registerStorefrontTheme).toHaveBeenCalledWith(manifest);
  });
});

describe('registerTheme + resolveActiveTheme', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
  });

  it('returns the registered theme when DB returns its id', async () => {
    const manifest = validManifest({ id: 'my-theme', name: 'My Theme' });
    registerTheme(manifest);

    prisma.setting.findUnique.mockResolvedValueOnce({
      key: 'activeTheme',
      value: 'my-theme',
    });

    const result = await resolveActiveTheme();
    expect(result).toBe(manifest);
  });

  it('returns null when DB returns no activeTheme setting', async () => {
    prisma.setting.findUnique.mockResolvedValueOnce(null);

    const result = await resolveActiveTheme();
    expect(result).toBeNull();
  });

  it('returns null when the active theme id is not in the registry', async () => {
    prisma.setting.findUnique.mockResolvedValueOnce({
      key: 'activeTheme',
      value: 'unknown-theme',
    });

    const result = await resolveActiveTheme();
    expect(result).toBeNull();
  });
});

describe('preloadStorefrontTheme', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
  });

  it('returns the active theme id and falls back to default', async () => {
    const manifest = validManifest({ id: 'shop-theme' });
    registerTheme(manifest);

    prisma.setting.findUnique.mockResolvedValue({
      key: 'activeTheme',
      value: 'shop-theme',
    });

    await expect(preloadStorefrontTheme()).resolves.toBe('shop-theme');
    await expect(preloadStorefrontTheme()).resolves.toBe('shop-theme');
    expect(prisma.setting.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns default when no active theme is configured', async () => {
    prisma.setting.findUnique.mockResolvedValueOnce(null);

    await expect(preloadStorefrontTheme()).resolves.toBe('default');
  });

  it('invalidates the preload cache', async () => {
    prisma.setting.findUnique.mockResolvedValueOnce({
      key: 'activeTheme',
      value: 'missing-theme',
    });

    await expect(preloadStorefrontTheme()).resolves.toBe('default');
    invalidateThemeCache();

    prisma.setting.findUnique.mockResolvedValueOnce({
      key: 'activeTheme',
      value: 'missing-theme',
    });

    await expect(preloadStorefrontTheme()).resolves.toBe('default');
    expect(prisma.setting.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Admin theme settings helpers
// ---------------------------------------------------------------------------

describe('loadThemeSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty object when the manifest has no settings', async () => {
    await expect(loadThemeSettings(null)).resolves.toEqual({});
    await expect(loadThemeSettings(validManifest())).resolves.toEqual({});
  });

  it('loads persisted values with defaults', async () => {
    get.mockResolvedValueOnce('dark').mockResolvedValueOnce(null);

    const manifest = validManifest({
      settings: [
        { key: 'accentColor', default: '#000' },
        { key: 'layout', default: 'wide' },
      ],
    });

    await expect(loadThemeSettings(manifest)).resolves.toEqual({
      accentColor: 'dark',
      layout: 'wide',
    });
  });
});

describe('parseThemeSettingValue', () => {
  it('normalizes toggle values', () => {
    expect(parseThemeSettingValue({ type: 'toggle' }, 'on')).toBe(true);
    expect(parseThemeSettingValue({ type: 'toggle' }, null)).toBe(false);
  });

  it('returns raw values for non-toggle settings', () => {
    expect(parseThemeSettingValue({ type: 'text' }, 'hello')).toBe('hello');
    expect(parseThemeSettingValue({ type: 'text' }, null)).toBe('');
  });
});

describe('saveThemeSettings + setActiveTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists theme settings from form data', async () => {
    const manifest = validManifest({
      settings: [
        { key: 'accentColor', type: 'text' },
        { key: 'darkMode', type: 'toggle' },
      ],
    });
    const formData = new FormData();
    formData.set('accentColor', '#fff');
    formData.set('darkMode', 'on');

    await saveThemeSettings('test-theme', manifest, formData);

    expect(set).toHaveBeenCalledWith('theme.test-theme.accentColor', '#fff');
    expect(set).toHaveBeenCalledWith('theme.test-theme.darkMode', true);
  });

  it('activates a theme and busts caches', async () => {
    await setActiveTheme('aurora');

    expect(set).toHaveBeenCalledWith('activeTheme', 'aurora');
    expect(cache.delete).toHaveBeenCalledWith('theme:active');
  });
});

// ---------------------------------------------------------------------------
// SLOT_NAMES
// ---------------------------------------------------------------------------

describe('SLOT_NAMES', () => {
  it('contains all expected slot names', () => {
    expect(SLOT_NAMES).toHaveLength(10);
    expect(SLOT_NAMES).toContain('layout.header');
  });
});

// ---------------------------------------------------------------------------
// getSlotBlocks
// ---------------------------------------------------------------------------

describe('getSlotBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to plugin block resolution', async () => {
    getPluginBlocksForSlot.mockResolvedValueOnce([
      { pluginId: 'hero', component: () => null },
    ]);

    await expect(getSlotBlocks('home.hero')).resolves.toEqual([
      { pluginId: 'hero', component: expect.any(Function) },
    ]);
    expect(getPluginBlocksForSlot).toHaveBeenCalledWith('home.hero');
  });
});

describe('getSlotBlocksMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a slot-keyed map for every requested slot', async () => {
    getPluginBlocksForSlot
      .mockResolvedValueOnce([{ pluginId: 'hero', component: () => null }])
      .mockResolvedValueOnce([{ pluginId: 'featured', component: () => null }]);

    const slotBlocks = await getSlotBlocksMap(['home.hero', 'home.featured']);

    expect(getPluginBlocksForSlot).toHaveBeenCalledTimes(2);
    expect(slotBlocks).toEqual({
      'home.hero': [{ pluginId: 'hero', component: expect.any(Function) }],
      'home.featured': [
        { pluginId: 'featured', component: expect.any(Function) },
      ],
    });
  });
});
