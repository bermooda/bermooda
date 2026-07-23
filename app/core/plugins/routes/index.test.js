import { describe, expect, it } from 'vitest';

import {
  buildPluginRouteRegistry,
  normalizePluginRoutePath,
  resolvePluginRouteDescriptor,
} from '#/core/plugins/routes';

describe('normalizePluginRoutePath', () => {
  it('strips leading and trailing slashes and query strings', () => {
    expect(normalizePluginRoutePath('/events/?tab=recent')).toBe('events/');
    expect(normalizePluginRoutePath('')).toBe('');
  });
});

describe('resolvePluginRouteDescriptor', () => {
  const routesByPlugin = new Map([
    [
      'sample-analytics',
      [{ path: '' }, { path: 'events', Component: () => null }],
    ],
  ]);

  it('matches exact paths and falls back to the root route', () => {
    expect(
      resolvePluginRouteDescriptor(routesByPlugin, 'sample-analytics', 'events')
    ).toEqual({ path: 'events', Component: expect.any(Function) });

    expect(
      resolvePluginRouteDescriptor(routesByPlugin, 'sample-analytics', '')
    ).toEqual({ path: '' });
  });

  it('returns null when no route matches', () => {
    expect(
      resolvePluginRouteDescriptor(
        routesByPlugin,
        'sample-analytics',
        'missing'
      )
    ).toBeNull();
  });
});

describe('buildPluginRouteRegistry', () => {
  it('indexes routes by plugin id extracted from module paths', () => {
    const registry = buildPluginRouteRegistry(
      {
        '/app/plugins/sample-analytics/admin/routes.client.js': {
          routes: [{ path: '' }],
        },
      },
      /\/plugins\/([^/]+)\/admin\/routes\.client\.js$/
    );

    expect(registry.get('sample-analytics')).toEqual([{ path: '' }]);
  });
});
