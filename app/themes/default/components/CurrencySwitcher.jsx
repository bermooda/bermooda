import { useFetcher, useLocation } from 'react-router';

export default function CurrencySwitcher({
  currentCurrency = 'USD',
  availableCurrencies = ['USD'],
}) {
  const fetcher = useFetcher();
  const location = useLocation();

  if (availableCurrencies.length <= 1) return null;

  return (
    <fetcher.Form method="post" action="/api/set-currency">
      <input
        type="hidden"
        name="returnTo"
        value={location.pathname + location.search}
      />
      <select
        name="currency"
        value={currentCurrency}
        onChange={(e) => fetcher.submit(e.currentTarget.form)}
        className="cursor-pointer border-none bg-transparent text-sm font-medium text-zinc-700 hover:text-zinc-900 focus:outline-none dark:text-zinc-300 dark:hover:text-zinc-100"
        aria-label="Currency"
      >
        {availableCurrencies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </fetcher.Form>
  );
}
