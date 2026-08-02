import clsx from 'clsx';
import { useState } from 'react';
import { useFetcher } from 'react-router';

import { useT } from '#/core/i18n';
import { AVAILABLE_CURRENCIES } from '#/core/settings/defaults';
import {
  CHECKBOX_CLASS,
  RADIO_CLASS,
  SaveButton,
  SectionCard,
} from '#/components/admin/settings/shared';
import Table, { TBody, Td, Th, THead } from '#/components/admin/table';

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

  function toggle(c) {
    setEnabled((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  return (
    <SectionCard title={t('admin.settings.currencies.title')}>
      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="save-currencies" />
        {enabled.map((c) => (
          <input key={c} type="hidden" name="currencies" value={c} />
        ))}
        <input type="hidden" name="defaultCurrency" value={defaultCurrency} />

        <p className="text-text-muted text-sm">
          {t('admin.settings.currencies.help')}
        </p>

        <Table>
          <THead>
            <tr>
              <Th>{t('admin.settings.currencies.col.currency')}</Th>
              <Th className="text-center">
                {t('admin.settings.currencies.col.enabled')}
              </Th>
              <Th className="text-center">
                {t('admin.settings.currencies.col.default')}
              </Th>
            </tr>
          </THead>
          <TBody>
            {AVAILABLE_CURRENCIES.map((c) => {
              const isEnabled = enabled.includes(c);
              const isDefault = defaultCurrency === c;
              return (
                <tr key={c}>
                  <Td className="text-text font-mono font-semibold">{c}</Td>
                  <Td className="text-center">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggle(c)}
                      className={CHECKBOX_CLASS}
                    />
                  </Td>
                  <Td className="text-center">
                    <input
                      type="radio"
                      checked={isDefault}
                      disabled={!isEnabled}
                      onChange={() => setDefaultCurrency(c)}
                      className={clsx(RADIO_CLASS, 'disabled:opacity-40')}
                    />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>

        <SaveButton fetcher={fetcher} intent="save-currencies" />
      </fetcher.Form>
    </SectionCard>
  );
}
