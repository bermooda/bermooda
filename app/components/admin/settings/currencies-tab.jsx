import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import { useT } from '#/core/i18n';
import { AVAILABLE_CURRENCIES } from '#/core/settings/defaults';
import {
  CHECKBOX_CLASS,
  RADIO_CLASS,
  SaveButton,
} from '#/components/admin/settings/shared';
import Table, { TBody, Td, Th, THead, Tr } from '#/components/admin/table';

/**
 * Currencies settings tab.
 *
 * @param {Object} props
 * @param {object} props.data
 * @returns {React.ReactElement}
 */
export function CurrenciesTab({ data }) {
  const t = useT();
  const fetcher = useFetcher();
  const [enabled, setEnabled] = useState(data.currencies);
  const [defaultCurrency, setDefaultCurrency] = useState(data.defaultCurrency);

  /**
   * @param {string} c
   */
  function toggle(c) {
    setEnabled((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-text text-base font-semibold">
          {t('admin.settings.currencies.title')}
        </h2>
        <p className="text-text-muted mt-1 text-sm">
          {t('admin.settings.currencies.help')}
        </p>
      </div>

      <fetcher.Form method="post" className="space-y-6">
        <input type="hidden" name="intent" value="save-currencies" />
        {enabled.map((c) => (
          <input key={c} type="hidden" name="currencies" value={c} />
        ))}
        <input type="hidden" name="defaultCurrency" value={defaultCurrency} />

        <Table variant="sticky" className="mt-2">
          <THead sticky>
            <tr>
              <Th sticky className="py-3.5 pr-3 pl-1 sm:pl-0">
                {t('admin.settings.currencies.col.currency')}
              </Th>
              <Th sticky className="px-3 py-3.5 text-center">
                {t('admin.settings.currencies.col.enabled')}
              </Th>
              <Th sticky className="px-3 py-3.5 text-center">
                {t('admin.settings.currencies.col.default')}
              </Th>
            </tr>
          </THead>
          <TBody sticky>
            {AVAILABLE_CURRENCIES.map((c) => {
              const isEnabled = enabled.includes(c);
              const isDefault = defaultCurrency === c;
              return (
                <Tr key={c}>
                  <Td
                    sticky
                    className="text-text py-4 pr-3 pl-1 font-medium whitespace-normal sm:pl-0"
                  >
                    <span className="block truncate font-mono font-medium">
                      {c}
                    </span>
                  </Td>
                  <Td sticky className="px-3 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggle(c)}
                      className={CHECKBOX_CLASS}
                      aria-label={t('admin.settings.currencies.col.enabled')}
                    />
                  </Td>
                  <Td sticky className="px-3 py-4 text-center">
                    <input
                      type="radio"
                      checked={isDefault}
                      disabled={!isEnabled}
                      onChange={() => setDefaultCurrency(c)}
                      className={clsx(RADIO_CLASS, 'disabled:opacity-40')}
                      aria-label={t('admin.settings.currencies.col.default')}
                    />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>

        <SaveButton fetcher={fetcher} intent="save-currencies" />
      </fetcher.Form>
    </div>
  );
}
