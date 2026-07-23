import { useFetcher, useLocation } from 'react-router';

import { LOCALE_LABELS, LOCALE_OPTIONS } from '#/core/i18n';
import { AVAILABLE_CURRENCIES } from '#/core/settings/defaults';
import {
  FieldLabel,
  SaveButton,
  SectionCard,
  inputClass,
  selectClass,
} from '#/components/admin/settings/shared';

/**
 * Admin locale switcher for the settings general tab.
 *
 * @param {Object} props
 * @param {string} props.adminLocale
 * @param {string[]} props.availableLocales
 * @returns {React.ReactElement|null}
 */
export function AdminLocaleField({ adminLocale, availableLocales }) {
  const fetcher = useFetcher();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  if (!availableLocales || availableLocales.length <= 1) return null;

  return (
    <fetcher.Form method="post" action="/api/set-locale">
      <input type="hidden" name="returnTo" value={returnTo} />
      <FieldLabel>Admin Interface Language</FieldLabel>
      <select
        name="locale"
        defaultValue={adminLocale}
        onChange={(event) => event.currentTarget.form.requestSubmit()}
        className={selectClass()}
      >
        {availableLocales.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale] ?? locale}
          </option>
        ))}
      </select>
      <p className="text-text-muted mt-1 text-xs">
        Language used in the admin back office.
      </p>
    </fetcher.Form>
  );
}

/**
 * General settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function GeneralTab({ data }) {
  const fetcher = useFetcher();

  return (
    <SectionCard title="General Settings">
      <div className="max-w-lg space-y-6">
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="save-general" />
          <div>
            <FieldLabel>Shop Name</FieldLabel>
            <input
              type="text"
              name="shopName"
              defaultValue={data.shopName}
              placeholder="My Awesome Store"
              className={inputClass()}
            />
          </div>
          <div>
            <FieldLabel>Contact Email</FieldLabel>
            <input
              type="email"
              name="contactEmail"
              defaultValue={data.contactEmail}
              placeholder="hello@example.com"
              className={inputClass()}
            />
          </div>
          <div>
            <FieldLabel>Default Locale</FieldLabel>
            <select
              name="defaultLocale"
              defaultValue={data.defaultLocale}
              className={selectClass()}
            >
              {(data.locales.length > 0 ? data.locales : LOCALE_OPTIONS).map(
                (l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <FieldLabel>Default Currency</FieldLabel>
            <select
              name="defaultCurrency"
              defaultValue={data.defaultCurrency}
              className={selectClass()}
            >
              {(data.currencies.length > 0
                ? data.currencies
                : AVAILABLE_CURRENCIES
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <SaveButton fetcher={fetcher} intent="save-general" />
        </fetcher.Form>

        <AdminLocaleField
          adminLocale={data.adminLocale}
          availableLocales={data.adminAvailableLocales}
        />
      </div>
    </SectionCard>
  );
}
