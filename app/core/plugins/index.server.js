// app/core/plugins/index.server.js
// Barrel re-exports for the plugins domain (backward-compatible public API).

export {
  getPluginSettingSecret,
  getPluginSettingValue,
  loadAllPluginSettings,
  loadPluginSettings,
  parsePluginSettingJsonValue,
  parsePluginSettingValue,
  pluginSettingStorageKey,
  redactPluginSettingValue,
  resolvePluginSettingForPersist,
  savePluginSettings,
  savePluginSettingsValues,
} from '#/core/plugins/settings.server';

// define* must be re-exported from define.server (not registry) so plugins that
// import this barrel during eager discovery get initialized bindings.
export {
  definePlugin,
  defineHooks,
  defineProvider,
  defineProviders,
} from '#/core/plugins/define.server';

export {
  listRegisteredPlugins,
  getRegisteredPlugin,
  getRegisteredPluginBySlug,
  register,
  discoverPlugins,
  resolvePluginAdminRoute,
  resolvePluginStorefrontRoute,
  __resetRegistry,
  registry as _registry,
} from '#/core/plugins/registry.server';
export {
  getEnabledPluginIds,
  isPluginEnabled,
  sortPluginsByOrder,
  buildFullPluginOrder,
  pluginProvidesType,
  setPluginEnabledState,
  setPluginOrder,
  enable,
  disable,
  enablePersistedPlugins,
} from '#/core/plugins/lifecycle.server';

export { getPluginBlocksForSlot } from '#/core/plugins/blocks.server';

export { buildCtx as _buildCtx } from '#/core/plugins/ctx.server';

export {
  deny,
  emitBefore,
  HookAbortError,
  isHookAbort,
} from '#/core/events/index.server';
