// app/test/factories/setting.js
export function makeSetting(overrides = {}) {
  return {
    id: 'setting_1',
    key: 'defaultCurrency',
    value: 'USD',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

export function makeSettings(map = {}) {
  const defaults = {
    defaultCurrency: 'USD',
    currencies: JSON.stringify(['USD', 'EUR', 'AUD']),
    defaultLocale: 'en',
    activeTheme: '@bermooda/theme-default',
  };
  return { ...defaults, ...map };
}
