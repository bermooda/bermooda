// app/core/extensions/discovery.test.js
import { describe, expect, it } from 'vitest';

import {
  extensionFolderFromPath,
  pairExtensionModules,
} from '#/core/extensions/discovery';

describe('extensionFolderFromPath', () => {
  it('returns the folder under the kind dir', () => {
    expect(
      extensionFolderFromPath('/app/themes/aurora/index.js', 'themes')
    ).toBe('aurora');
    expect(
      extensionFolderFromPath('/app/plugins/meili/package.json', 'plugins')
    ).toBe('meili');
  });

  it('throws when the path is not under the kind dir', () => {
    expect(() =>
      extensionFolderFromPath('/app/plugins/meili/index.js', 'themes')
    ).toThrow(/Cannot parse themes folder/);
  });
});

describe('pairExtensionModules', () => {
  it('pairs modules with the package.json from the same folder', () => {
    const auroraMod = { default: { components: {} } };
    const auroraPkg = { name: '@x/theme-aurora' };
    const auroraProPkg = { name: '@x/theme-aurora-pro' };

    expect(
      pairExtensionModules(
        {
          '/app/themes/aurora/index.js': auroraMod,
          '/app/themes/orphan/index.js': {},
        },
        {
          '/app/themes/aurora-pro/package.json': auroraProPkg,
          '/app/themes/aurora/package.json': auroraPkg,
        },
        'themes'
      )
    ).toEqual([
      { folder: 'aurora', mod: auroraMod, pkg: auroraPkg },
      { folder: 'orphan', mod: {}, pkg: undefined },
    ]);
  });
});
