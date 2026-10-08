// app/core/plugins/registry.test.server.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#/utils/logger.server', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import logger from '#/utils/logger.server';
import {
  __discoverPluginsFrom,
  __resetRegistry,
  getRegisteredPluginBySlug,
  listRegisteredPlugins,
} from '#/core/plugins/registry.server';

/**
 * @param {string} slug
 * @param {Record<string, unknown>} [bermooda]
 */
function pkg(slug, bermooda = {}) {
  return {
    name: `@bermooda/plugin-${slug}`,
    version: '1.0.0',
    bermooda: { title: slug, slug, engine: '>=0.0.0', ...bermooda },
  };
}

/** @param {string} folder */
const modPath = (folder) => `/app/plugins/${folder}/index.server.js`;
/** @param {string} folder */
const pkgPath = (folder) => `/app/plugins/${folder}/package.json`;

describe('__discoverPluginsFrom', () => {
  beforeEach(() => {
    __resetRegistry();
    vi.clearAllMocks();
  });

  it('registers plugins and prefers the pluginManifest export', () => {
    __discoverPluginsFrom(
      { [modPath('search')]: { pluginManifest: { hooks: {} } } },
      { [pkgPath('search')]: pkg('search') }
    );

    expect(getRegisteredPluginBySlug('search')).toMatchObject({
      id: '@bermooda/plugin-search',
      slug: 'search',
    });
  });

  it('soft-skips incompatible engines and logs', () => {
    __discoverPluginsFrom(
      { [modPath('future')]: {} },
      { [pkgPath('future')]: pkg('future', { engine: '>=999.0.0' }) }
    );

    expect(listRegisteredPlugins()).toHaveLength(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'future' }),
      'Skipping incompatible plugin'
    );
  });

  it('soft-skips malformed packages and slug/folder mismatches', () => {
    __discoverPluginsFrom(
      {
        [modPath('no-title')]: {},
        [modPath('renamed')]: {},
        [modPath('good')]: {},
      },
      {
        [pkgPath('no-title')]: pkg('no-title', { title: '' }),
        [pkgPath('renamed')]: pkg('other-slug'),
        [pkgPath('good')]: pkg('good'),
      }
    );

    expect(listRegisteredPlugins().map((p) => p.slug)).toEqual(['good']);
    for (const folder of ['no-title', 'renamed']) {
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ folder, err: expect.any(Error) }),
        'Skipping malformed plugin'
      );
    }
  });

  it('throws when a plugin folder has no package.json', () => {
    expect(() =>
      __discoverPluginsFrom({ [modPath('orphan')]: {} }, {})
    ).toThrow(/Missing package.json for plugin folder "orphan"/);
  });
});
