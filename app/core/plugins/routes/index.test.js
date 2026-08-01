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
    ['demo-plugin', [{ path: '' }, { path: 'events', Component: () => null }]],
  ]);

  it('matches exact paths and falls back to the root route', () => {
    expect(
      resolvePluginRouteDescriptor(routesByPlugin, 'demo-plugin', 'events')
    ).toEqual({
      path: 'events',
      Component: expect.any(Function),
      params: {},
    });

    expect(
      resolvePluginRouteDescriptor(routesByPlugin, 'demo-plugin', '')
    ).toEqual({ path: '', params: {} });
  });

  it('returns null when no route matches', () => {
    expect(
      resolvePluginRouteDescriptor(routesByPlugin, 'demo-plugin', 'missing')
    ).toBeNull();
  });

  it('matches :param segments and returns captured params', () => {
    const map = new Map([
      [
        'demo',
        [
          { path: 'orders/:id' },
          { path: 'orders/exact' },
          { path: 'orders/:id/edit' },
        ],
      ],
    ]);

    const match = resolvePluginRouteDescriptor(map, 'demo', 'orders/abc');
    expect(match.path).toBe('orders/:id');
    expect(match.params).toEqual({ id: 'abc' });

    expect(
      resolvePluginRouteDescriptor(map, 'demo', 'orders/exact')
    ).toMatchObject({ path: 'orders/exact', params: {} });

    expect(
      resolvePluginRouteDescriptor(map, 'demo', 'orders/abc/edit')
    ).toMatchObject({
      path: 'orders/:id/edit',
      params: { id: 'abc' },
    });
  });

  it('matches trailing * splat and uses first registered pattern', () => {
    const map = new Map([
      [
        'demo',
        [
          { path: 'files/*' },
          { path: 'files/:name/*' },
          { path: 'catch-all/*' },
        ],
      ],
    ]);

    expect(
      resolvePluginRouteDescriptor(map, 'demo', 'files/a/b/c')
    ).toMatchObject({
      path: 'files/*',
      params: { splat: 'a/b/c' },
    });

    expect(
      resolvePluginRouteDescriptor(map, 'demo', 'files/report/q1')
    ).toMatchObject({
      path: 'files/*',
      params: { splat: 'report/q1' },
    });

    expect(
      resolvePluginRouteDescriptor(map, 'demo', 'catch-all/x')
    ).toMatchObject({
      path: 'catch-all/*',
      params: { splat: 'x' },
    });
  });

  it('matches :param with trailing splat', () => {
    const map = new Map([['demo', [{ path: 'docs/:section/*' }]]]);

    expect(
      resolvePluginRouteDescriptor(map, 'demo', 'docs/api/v1/ref')
    ).toMatchObject({
      path: 'docs/:section/*',
      params: { section: 'api', splat: 'v1/ref' },
    });
  });
});

describe('buildPluginRouteRegistry', () => {
  it('indexes routes by plugin id extracted from module paths', () => {
    const registry = buildPluginRouteRegistry(
      {
        '/app/plugins/demo-plugin/admin/routes.client.js': {
          routes: [{ path: '' }],
        },
      },
      /\/plugins\/([^/]+)\/admin\/routes\.client\.js$/
    );

    expect(registry.get('demo-plugin')).toEqual([{ path: '' }]);
  });
});
