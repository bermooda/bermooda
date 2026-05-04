export function resolveActiveTheme() {
  // Phase 3 (P3-5) will TTL-cache Setting.activeTheme
  // Returns a stub default theme descriptor
  return { name: 'default', components: {} };
}

export function getStorefrontComponent(_name) {
  // Phase 3 (P3-5) will look up components from the active theme
  // Returns null if the component is not found
  return null;
}
