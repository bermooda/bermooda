// app/core/i18n/context.js
// React context for the i18n translation function.
// The provider will be wired up in P6 (storefront).

import { createContext } from 'react';

export const I18nContext = createContext({ t: (key) => key });
