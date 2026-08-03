// app/core/plugins/define.test.server.js
// Keeps define* helpers free of registry/plugin discovery so barrel imports
// stay safe during eager import.meta.glob of plugins.

import { describe, expect, it } from 'vitest';

import {
  PROVIDER_TYPES,
  defineHooks,
  definePlugin,
  defineProvider,
  defineProviders,
} from '#/core/plugins/define.server';

describe('define.server — cycle-safe define helpers', () => {
  it('exports defineProvider as a function without loading the registry', () => {
    expect(typeof defineProvider).toBe('function');
    expect(typeof definePlugin).toBe('function');
    expect(typeof defineHooks).toBe('function');
    expect(typeof defineProviders).toBe('function');
  });

  it('lists supported provider types', () => {
    expect(PROVIDER_TYPES).toContain('email');
    expect(PROVIDER_TYPES).toContain('payment');
  });

  it('defineProvider returns typed specs', () => {
    const result = defineProvider('email', {
      name: 'Test',
      send: async () => {},
    });
    expect(result).toMatchObject({ type: 'email', name: 'Test' });
  });
});
