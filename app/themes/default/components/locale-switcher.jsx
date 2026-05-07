import { useFetcher, useLocation } from 'react-router';

const LOCALE_NAMES = { en: 'EN', de: 'DE', fr: 'FR' };

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
        className="cursor-pointer border-none bg-transparent text-sm font-medium text-zinc-700 hover:text-zinc-900 focus:outline-none dark:text-zinc-300 dark:hover:text-zinc-100"
        aria-label="Language"
      >
        {availableLocales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l] ?? l.toUpperCase()}
          </option>
        ))}
      </select>
    </fetcher.Form>
  );
}
