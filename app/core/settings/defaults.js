// app/core/settings/defaults.js
// Client-safe default values for shop settings.

import { DEFAULT_LOCALE } from '#/core/i18n/locales';

export const DEFAULT_CURRENCY = 'USD';

export const DEFAULT_CURRENCIES = ['USD', 'EUR', 'AUD'];

export const AVAILABLE_CURRENCIES = ['USD', 'EUR', 'AUD', 'GBP', 'CAD', 'JPY'];

export const DEFAULT_LOCALES = ['en', 'de', 'fr'];

export const DEFAULT_STOREFRONT_LOCALES = ['en'];

export const DEFAULT_ACTIVE_THEME = '@bermooda/theme-default';

export const DEFAULT_PLUGIN_ORDER = [];

export const DEFAULT_ENABLED_PLUGINS = [];

/** Values written by seedDefaults when a key is absent from the DB. */
export const SETTING_DEFAULTS = {
  'defaultCurrency': DEFAULT_CURRENCY,
  'currencies': DEFAULT_CURRENCIES,
  'defaultLocale': DEFAULT_LOCALE,
  'locales': DEFAULT_LOCALES,
  'activeTheme': DEFAULT_ACTIVE_THEME,
  'pluginOrder': DEFAULT_PLUGIN_ORDER,
  'addressValidation.provider': 'noop',
};
