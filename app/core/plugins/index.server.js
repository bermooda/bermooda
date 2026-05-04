export function loadPlugins() {
  // Phase 3 (P3-4) will implement full plugin loading from app/plugins/*
  // Returns an empty registry for now
  return { plugins: [], hooks: {} };
}

export function resolvePluginRoute(_pluginId, _path) {
  // Phase 3 (P3-4) will resolve plugin admin/storefront page descriptors
  // Returns null when no plugin matches
  return null;
}
