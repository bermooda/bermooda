// app/core/i18n/context.js
// React context for the i18n translation function and active locale.
// Provided by the admin and storefront layouts.

import { createContext } from 'react';

export const I18nContext = createContext({ t: (key) => key, locale: 'en' });
