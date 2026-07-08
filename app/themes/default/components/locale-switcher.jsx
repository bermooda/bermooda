import { useFetcher, useLocation } from 'react-router';

import { LOCALE_LABELS } from '#/core/i18n/locales';

function localeAbbreviation(locale) {
  return (
    LOCALE_LABELS[locale]?.slice(0, 2).toUpperCase() ?? locale.toUpperCase()
  );
}

export default function LocaleSwitcher({
  currentLocale = 'en',
  availableLocales = ['en'],
}) {
  const fetcher = useFetcher();
  const location = useLocation();

  if (availableLocales.length <= 1) return null;

  return (
    <fetcher.Form method="post" action="/api/set-locale">
      <input
        type="hidden"
        name="returnTo"
        value={location.pathname + location.search}
      />
      <select
        name="locale"
        value={currentLocale}
        onChange={(e) => fetcher.submit(e.currentTarget.form)}
        className="cursor-pointer border-none bg-transparent text-sm font-medium text-stone-600 hover:text-stone-900 focus:outline-none"
        aria-label="Language"
      >
        {availableLocales.map((l) => (
          <option key={l} value={l}>
            {localeAbbreviation(l)}
          </option>
        ))}
      </select>
    </fetcher.Form>
  );
}
