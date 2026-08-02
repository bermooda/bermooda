import { useFetcher, useLocation } from 'react-router';

import { LOCALE_LABELS, LOCALE_OPTIONS, useT } from '#/core/i18n';
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
  const t = useT();
  const fetcher = useFetcher();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  if (!availableLocales || availableLocales.length <= 1) return null;

  return (
    <fetcher.Form method="post" action="/api/set-locale">
      <input type="hidden" name="returnTo" value={returnTo} />
      <FieldLabel>{t('admin.settings.general.adminLocale')}</FieldLabel>
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
        {t('admin.settings.general.adminLocaleHelp')}
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
  const t = useT();
  const fetcher = useFetcher();

  return (
    <SectionCard title={t('admin.settings.general.title')}>
      <div className="max-w-lg space-y-6">
        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="save-general" />
          <div>
            <FieldLabel>{t('admin.settings.general.shopName')}</FieldLabel>
            <input
              type="text"
              name="shopName"
              defaultValue={data.shopName}
              placeholder={t('admin.settings.general.shopNamePlaceholder')}
              className={inputClass()}
            />
          </div>
          <div>
            <FieldLabel>{t('admin.settings.general.contactEmail')}</FieldLabel>
            <input
              type="email"
              name="contactEmail"
              defaultValue={data.contactEmail}
              placeholder={t('admin.settings.general.contactEmailPlaceholder')}
              className={inputClass()}
            />
          </div>
          <div>
            <FieldLabel>{t('admin.settings.general.defaultLocale')}</FieldLabel>
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
            <FieldLabel>
              {t('admin.settings.general.defaultCurrency')}
            </FieldLabel>
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
