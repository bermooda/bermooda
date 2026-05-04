// app/core/themes/themes.test.server.js
// Server-environment tests for the theme loader (runs in Node, not happy-dom).

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// Mock prisma — no real database.
vi.mock('#/libs/prisma.server', () => ({
  default: {
    setting: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock the cache utility so we can control what the DB returns per test.
vi.mock('#/utils/cache.server', () => ({
  getCachedResult: vi.fn(async (_key, callback) => callback()),
  default: {},
}));

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are registered.
// ---------------------------------------------------------------------------

const {
  defineTheme,
  registerTheme,
  resolveActiveTheme,
  getStorefrontComponent,
  getSlotBlocks,
  SLOT_NAMES,
  _registry,
} = await import('./index.server.js');

import prisma from '#/libs/prisma.server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validManifest(overrides = {}) {
  return {
    id: 'test-theme',
    name: 'Test Theme',
    version: '1.0.0',
    components: {
      Layout: () => null,
      HomePage: () => null,
      ProductPage: () => null,
      CategoryPage: () => null,
      CartPage: () => null,
      CheckoutLayout: () => null,
      NotFoundPage: () => null,
    },
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

  it('throws when "id" is an empty string', () => {
    expect(() => defineTheme(validManifest({ id: '' }))).toThrow(/id/);
  });

  it('throws when "id" is whitespace only', () => {
    expect(() => defineTheme(validManifest({ id: '   ' }))).toThrow(/id/);
  });

  it('throws when "name" is missing', () => {
    const { name: _name, ...noName } = validManifest();
    expect(() => defineTheme(noName)).toThrow(/name/);
  });

  it('throws when "name" is an empty string', () => {
    expect(() => defineTheme(validManifest({ name: '' }))).toThrow(/name/);
  });

  it('throws when "version" is missing', () => {
    const { version: _version, ...noVersion } = validManifest();
    expect(() => defineTheme(noVersion)).toThrow(/version/);
  });

  it('throws when "version" is an empty string', () => {
    expect(() => defineTheme(validManifest({ version: '' }))).toThrow(/version/);
  });

  it('throws when "components" is missing', () => {
    const { components: _components, ...noComponents } = validManifest();
    expect(() => defineTheme(noComponents)).toThrow(/components/);
  });

  it('throws when manifest is null', () => {
    expect(() => defineTheme(null)).toThrow();
  });

  it('throws when manifest is a string', () => {
    expect(() => defineTheme('theme')).toThrow();
  });

  it('throws when manifest is a number', () => {
    expect(() => defineTheme(42)).toThrow();
  });

  it('accepts optional description field without throwing', () => {
    const manifest = validManifest({ description: 'A storefront theme' });
    expect(() => defineTheme(manifest)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// defineTheme — required component validation
// ---------------------------------------------------------------------------

describe('defineTheme — required component presence', () => {
  const REQUIRED = [
    'Layout',
    'HomePage',
    'ProductPage',
    'CategoryPage',
    'CartPage',
    'CheckoutLayout',
    'NotFoundPage',
  ];

  for (const componentName of REQUIRED) {
    it(`throws when "${componentName}" is absent from manifest.components`, () => {
      const manifest = validManifest();
      delete manifest.components[componentName];
      expect(() => defineTheme(manifest)).toThrow(new RegExp(componentName));
    });
  }
});

// ---------------------------------------------------------------------------
// registerTheme + resolveActiveTheme
// ---------------------------------------------------------------------------

describe('registerTheme + resolveActiveTheme', () => {
  beforeEach(() => {
    _registry.clear();
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

// ---------------------------------------------------------------------------
// getStorefrontComponent
// ---------------------------------------------------------------------------

describe('getStorefrontComponent', () => {
  beforeEach(() => {
    _registry.clear();
    vi.clearAllMocks();
  });

  it('returns the correct component for the active theme', async () => {
    const LayoutComponent = () => null;
    const manifest = validManifest({
      id: 'shop-theme',
      components: {
        Layout: LayoutComponent,
        HomePage: () => null,
        ProductPage: () => null,
        CategoryPage: () => null,
        CartPage: () => null,
        CheckoutLayout: () => null,
        NotFoundPage: () => null,
      },
    });
    registerTheme(manifest);

    prisma.setting.findUnique.mockResolvedValue({
      key: 'activeTheme',
      value: 'shop-theme',
    });

    const component = await getStorefrontComponent('Layout');
    expect(component).toBe(LayoutComponent);
  });

  it('returns null when the component name does not exist in the theme', async () => {
    const manifest = validManifest({ id: 'shop-theme-2' });
    registerTheme(manifest);

    prisma.setting.findUnique.mockResolvedValue({
      key: 'activeTheme',
      value: 'shop-theme-2',
    });

    const component = await getStorefrontComponent('NonExistentComponent');
    expect(component).toBeNull();
  });

  it('returns null when there is no active theme', async () => {
    prisma.setting.findUnique.mockResolvedValueOnce(null);

    const component = await getStorefrontComponent('Layout');
    expect(component).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SLOT_NAMES
// ---------------------------------------------------------------------------

describe('SLOT_NAMES', () => {
  it('is an array', () => {
    expect(Array.isArray(SLOT_NAMES)).toBe(true);
  });

  it('has exactly 10 entries', () => {
    expect(SLOT_NAMES).toHaveLength(10);
  });

  it('contains all expected slot names', () => {
    const expected = [
      'home.hero',
      'home.featured',
      'product.afterDescription',
      'product.sidebar',
      'category.top',
      'cart.summary',
      'checkout.afterPayment',
      'account.dashboard',
      'layout.header',
      'layout.footer',
    ];
    expect(SLOT_NAMES).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// getSlotBlocks
// ---------------------------------------------------------------------------

describe('getSlotBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty array for any slot name', async () => {
    prisma.setting.findUnique.mockResolvedValueOnce(null);

    const blocks = await getSlotBlocks('home.hero');
    expect(blocks).toEqual([]);
  });

  it('returns an empty array for every well-known slot', async () => {
    for (const slotName of SLOT_NAMES) {
      prisma.setting.findUnique.mockResolvedValueOnce(null);
      const blocks = await getSlotBlocks(slotName);
      expect(blocks).toEqual([]);
    }
  });
});
