// app/core/extensions/discovery.js
// Client-safe helpers for pairing `import.meta.glob` extension modules with
// their package.json. Shared by server theme/plugin discovery and the
// storefront theme registry.

/**
 * @typedef {'themes' | 'plugins'} ExtensionKindDir
 */

/**
 * @template M
 * @typedef {Object} ExtensionGlobEntry
 * @property {string} folder - Folder name under `app/<kind>/`
 * @property {M} mod - The glob-loaded runtime module
 * @property {unknown} pkg - Parsed package.json, or undefined when missing
 */

/**
 * Returns the extension folder segment from a glob path such as
 * `/app/themes/<folder>/index.js`.
 *
 * @param {string} globPath
 * @param {ExtensionKindDir} kind
 * @returns {string}
 */
export function extensionFolderFromPath(globPath, kind) {
  const match = globPath.match(new RegExp(`/${kind}/([^/]+)/`));
  if (!match) {
    throw new Error(`Cannot parse ${kind} folder from "${globPath}"`);
  }
  return match[1];
}

/**
 * Pairs each glob-loaded extension module with the package.json from the same
 * folder. `pkg` is undefined when the folder has no package.json; callers
 * decide whether that is fatal.
 *
 * @template M
 * @param {Record<string, M>} modules
 * @param {Record<string, unknown>} packages
 * @param {ExtensionKindDir} kind
 * @returns {ExtensionGlobEntry<M>[]}
 */
export function pairExtensionModules(modules, packages, kind) {
  /** @type {Map<string, unknown>} */
  const packagesByFolder = new Map();
  for (const [pkgPath, pkg] of Object.entries(packages)) {
    packagesByFolder.set(extensionFolderFromPath(pkgPath, kind), pkg);
  }

  return Object.entries(modules).map(([modPath, mod]) => {
    const folder = extensionFolderFromPath(modPath, kind);
    return { folder, mod, pkg: packagesByFolder.get(folder) };
  });
}
